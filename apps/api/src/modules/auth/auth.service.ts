import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import type { User } from '@prisma/client';
import type { UserRole } from '@forge/shared';
import { prisma } from '../../lib/prisma';
import { signAccessToken } from '../../lib/tokens';
import { decryptFromString, encryptToString, randomToken, sha256 } from '../../lib/crypto';
import { badRequest, conflict, unauthorized } from '../../lib/errors';
import { env } from '../../config/env';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

async function issueTokens(user: Pick<User, 'id' | 'role'>, meta: SessionMeta): Promise<TokenPair> {
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL * 1000),
    },
  });
  return {
    accessToken: signAccessToken(user.id, user.role as UserRole),
    refreshToken,
  };
}

export async function register(
  input: { email: string; password: string; name: string },
  meta: SessionMeta,
): Promise<{ user: User; tokens: TokenPair }> {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw conflict('An account with this email already exists');

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    },
  });

  // Every user starts with a personal workspace on the Free plan.
  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
  await prisma.workspace.create({
    data: {
      name: `${input.name}'s Workspace`,
      slug: `ws-${user.id.slice(-8)}`,
      members: { create: { userId: user.id, role: 'OWNER' } },
      subscription: { create: { planId: freePlan.id, status: 'ACTIVE' } },
    },
  });

  return { user, tokens: await issueTokens(user, meta) };
}

export async function login(
  input: { email: string; password: string; totpCode?: string },
  meta: SessionMeta,
): Promise<{ user: User; tokens: TokenPair } | { requiresTotp: true }> {
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  // Constant-shape failure: never reveal whether the email exists.
  if (!user?.passwordHash) throw unauthorized('Invalid credentials');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid credentials');

  if (user.totpEnabled) {
    if (!input.totpCode) return { requiresTotp: true };
    if (!user.totpSecretEnc) throw unauthorized('Invalid credentials');
    const valid = authenticator.verify({
      token: input.totpCode,
      secret: decryptFromString(user.totpSecretEnc),
    });
    if (!valid) throw unauthorized('Invalid 2FA code');
  }

  return { user, tokens: await issueTokens(user, meta) };
}

/** Rotating refresh: old token is revoked, a new one is issued. Reuse => revoke all sessions. */
export async function refresh(refreshToken: string, meta: SessionMeta): Promise<TokenPair> {
  const hash = sha256(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: true },
  });
  if (!stored) throw unauthorized('Invalid refresh token');
  if (stored.revokedAt) {
    // Token reuse — likely theft. Kill every session for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized('Refresh token reuse detected; all sessions revoked');
  }
  if (stored.expiresAt < new Date()) throw unauthorized('Refresh token expired');

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  return issueTokens(stored.user, meta);
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function setupTotp(userId: string): Promise<{ otpauthUrl: string; qrDataUrl: string }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.totpEnabled) throw badRequest('2FA already enabled');
  const secret = authenticator.generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecretEnc: encryptToString(secret) },
  });
  const otpauthUrl = authenticator.keyuri(user.email, 'FrontendForge Pro', secret);
  return { otpauthUrl, qrDataUrl: await qrcode.toDataURL(otpauthUrl) };
}

export async function confirmTotp(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecretEnc) throw badRequest('Run 2FA setup first');
  const valid = authenticator.verify({ token: code, secret: decryptFromString(user.totpSecretEnc) });
  if (!valid) throw badRequest('Invalid 2FA code');
  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
}
