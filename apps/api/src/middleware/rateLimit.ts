import type { NextFunction, Request, Response } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../lib/redis';
import { tooMany } from '../lib/errors';

function makeLimiter(keyPrefix: string, points: number, durationSec: number) {
  const limiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: `rl:${keyPrefix}`,
    points,
    duration: durationSec,
  });
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.auth?.userId ?? req.ip ?? 'anonymous';
    try {
      const r = await limiter.consume(key);
      res.setHeader('X-RateLimit-Remaining', String(r.remainingPoints));
      next();
    } catch {
      next(tooMany());
    }
  };
}

/** Global limit: 300 req/min per identity. */
export const globalLimiter = makeLimiter('global', 300, 60);
/** Auth endpoints: 10 attempts/min — brute-force mitigation. */
export const authLimiter = makeLimiter('auth', 10, 60);
/** AI generation: 20/min ceiling regardless of plan (plan limits enforced separately). */
export const generationLimiter = makeLimiter('gen', 20, 60);
/** Public analytics ingest: 600/min per IP. */
export const analyticsLimiter = makeLimiter('analytics', 600, 60);
