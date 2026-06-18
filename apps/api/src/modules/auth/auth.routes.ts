import { Router } from 'express';
import { loginSchema, registerSchema, totpVerifySchema } from '@forge/shared';
import * as authService from './auth.service';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import { audit } from '../../lib/audit';
import { prisma } from '../../lib/prisma';
import { env, isProd } from '../../config/env';
import { unauthorized } from '../../lib/errors';

export const authRouter = Router();

const REFRESH_COOKIE = 'forge_rt';

function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: env.REFRESH_TOKEN_TTL * 1000,
  });
}

authRouter.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { user, tokens } = await authService.register(req.body, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    audit({ userId: user.id, action: 'auth.register', ip: req.ip });
    setRefreshCookie(res, tokens.refreshToken);
    res.status(201).json({
      accessToken: tokens.accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    if ('requiresTotp' in result) {
      res.json({ requiresTotp: true });
      return;
    }
    audit({ userId: result.user.id, action: 'auth.login', ip: req.ip });
    setRefreshCookie(res, result.tokens.refreshToken);
    res.json({
      accessToken: result.tokens.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/refresh', authLimiter, async (req, res, next) => {
  try {
    // CSRF defense-in-depth: cookie is SameSite=strict AND a custom header is required.
    if (req.get('x-forge-csrf') !== '1') throw unauthorized('Missing CSRF header');
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw unauthorized('No refresh token');
    const tokens = await authService.refresh(token, {
      userAgent: req.get('user-agent') ?? undefined,
      ip: req.ip,
    });
    setRefreshCookie(res, tokens.refreshToken);
    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) await authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.auth!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        totpEnabled: true,
        credits: true,
        createdAt: true,
      },
    });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    res.json(await authService.setupTotp(req.auth!.userId));
  } catch (err) {
    next(err);
  }
});

authRouter.post(
  '/2fa/confirm',
  requireAuth,
  validate(totpVerifySchema),
  async (req, res, next) => {
    try {
      await authService.confirmTotp(req.auth!.userId, req.body.code);
      audit({ userId: req.auth!.userId, action: 'auth.2fa_enabled', ip: req.ip });
      res.json({ enabled: true });
    } catch (err) {
      next(err);
    }
  },
);
