import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../lib/errors';

export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest('Validation failed', result.error.flatten().fieldErrors));
    }
    // Replace with the parsed (and thereby sanitized/coerced) value.
    // req.query is getter-only in Express 4 — shadow it with an own property.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
}
