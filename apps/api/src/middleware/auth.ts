import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@forge/shared';
import { verifyAccessToken } from '../lib/tokens';
import { unauthorized, forbidden } from '../lib/errors';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { userId: string; role: UserRole };
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.auth = { userId: payload.sub, role: payload.role };
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden());
    next();
  };
}
