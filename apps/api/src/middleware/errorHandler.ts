import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { isProd } from '../config/env';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  logger.error('Unhandled error', {
    path: req.path,
    method: req.method,
    err: err instanceof Error ? err.stack : String(err),
  });
  Sentry.captureException(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: isProd ? 'Internal server error' : String(err),
    },
  });
}
