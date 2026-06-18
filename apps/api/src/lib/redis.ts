import Redis from 'ioredis';
import { env } from '../config/env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

/**
 * Plain options for BullMQ (it bundles its own ioredis, so we pass options
 * instead of a client instance; maxRetriesPerRequest: null is required).
 */
export function bullConnectionOptions(): {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: null;
} {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
