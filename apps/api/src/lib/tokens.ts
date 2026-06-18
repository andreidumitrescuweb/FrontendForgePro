import jwt from 'jsonwebtoken';
import type { UserRole } from '@forge/shared';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  type: 'access';
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessTokenPayload = { sub: userId, role, type: 'access' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== 'access') throw new Error('Wrong token type');
  return decoded;
}
