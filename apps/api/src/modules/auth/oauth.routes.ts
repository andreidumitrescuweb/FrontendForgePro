import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { signAccessToken } from '../../lib/tokens';
import { randomToken, sha256 } from '../../lib/crypto';
import { badRequest } from '../../lib/errors';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import type { UserRole } from '@forge/shared';

export const oauthRouter = Router();

type Provider = 'google' | 'github' | 'linkedin';

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
  /** Map raw profile JSON to a normalized identity. */
  mapProfile: (raw: Record<string, unknown>) => { id: string; email?: string; name: string; avatar?: string };
}

const providers: Record<Provider, ProviderConfig> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    scope: 'openid email profile',
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    mapProfile: (p) => ({
      id: String(p.sub),
      email: p.email as string | undefined,
      name: (p.name as string) ?? 'Google User',
      avatar: p.picture as string | undefined,
    }),
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    mapProfile: (p) => ({
      id: String(p.id),
      email: p.email as string | undefined,
      name: (p.name as string) ?? (p.login as string),
      avatar: p.avatar_url as string | undefined,
    }),
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    userUrl: 'https://api.linkedin.com/v2/userinfo',
    scope: 'openid profile email',
    clientId: env.LINKEDIN_CLIENT_ID,
    clientSecret: env.LINKEDIN_CLIENT_SECRET,
    mapProfile: (p) => ({
      id: String(p.sub),
      email: p.email as string | undefined,
      name: (p.name as string) ?? 'LinkedIn User',
      avatar: p.picture as string | undefined,
    }),
  },
};

function redirectUri(provider: Provider): string {
  return `${env.API_URL}/api/v1/oauth/${provider}/callback`;
}

oauthRouter.get('/:provider/start', async (req, res, next) => {
  try {
    const provider = req.params.provider as Provider;
    const cfg = providers[provider];
    if (!cfg?.clientId) throw badRequest(`OAuth provider ${provider} is not configured`);

    const state = crypto.randomBytes(24).toString('hex');
    await redis.setex(`oauth:state:${state}`, 600, provider);

    const url = new URL(cfg.authUrl);
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('redirect_uri', redirectUri(provider));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', cfg.scope);
    url.searchParams.set('state', state);
    res.redirect(url.toString());
  } catch (err) {
    next(err);
  }
});

oauthRouter.get('/:provider/callback', async (req, res, next) => {
  try {
    const provider = req.params.provider as Provider;
    const cfg = providers[provider];
    const { code, state } = req.query as { code?: string; state?: string };
    if (!cfg?.clientId || !cfg.clientSecret || !code || !state) throw badRequest('Invalid OAuth callback');

    const storedProvider = await redis.get(`oauth:state:${state}`);
    if (storedProvider !== provider) throw badRequest('Invalid OAuth state');
    await redis.del(`oauth:state:${state}`);

    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: redirectUri(provider),
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) throw badRequest('OAuth token exchange failed');

    const profileRes = await fetch(cfg.userUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: 'application/json' },
    });
    const profile = cfg.mapProfile((await profileRes.json()) as Record<string, unknown>);

    let account = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId: profile.id } },
      include: { user: true },
    });

    let user = account?.user ?? null;
    if (!user) {
      const email = profile.email?.toLowerCase();
      user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: email ?? `${provider}-${profile.id}@noemail.frontendforge.local`,
            name: profile.name,
            avatarUrl: profile.avatar,
            emailVerifiedAt: email ? new Date() : null,
          },
        });
        const freePlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
        await prisma.workspace.create({
          data: {
            name: `${profile.name}'s Workspace`,
            slug: `ws-${user.id.slice(-8)}`,
            members: { create: { userId: user.id, role: 'OWNER' } },
            subscription: { create: { planId: freePlan.id, status: 'ACTIVE' } },
          },
        });
      }
      await prisma.oAuthAccount.create({
        data: { provider, providerAccountId: profile.id, userId: user.id },
      });
    }

    const refreshToken = randomToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
        ip: req.ip,
      },
    });
    audit({ userId: user.id, action: `auth.oauth_login.${provider}`, ip: req.ip });

    res.cookie('forge_rt', refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax', // cross-site redirect from the provider requires lax here
      path: '/api/v1/auth',
      maxAge: env.REFRESH_TOKEN_TTL * 1000,
    });
    const access = signAccessToken(user.id, user.role as UserRole);
    res.redirect(`${env.WEB_URL}/oauth/complete#access_token=${access}`);
  } catch (err) {
    next(err);
  }
});
