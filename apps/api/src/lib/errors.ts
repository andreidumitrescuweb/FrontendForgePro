export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Authentication required') =>
  new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Insufficient permissions') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Resource not found') => new HttpError(404, 'NOT_FOUND', msg);
export const conflict = (msg: string) => new HttpError(409, 'CONFLICT', msg);
export const tooMany = (msg = 'Rate limit exceeded') => new HttpError(429, 'RATE_LIMITED', msg);
export const planLimit = (msg: string) => new HttpError(402, 'PLAN_LIMIT', msg);
