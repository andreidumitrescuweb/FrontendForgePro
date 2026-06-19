import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Run the generation worker inside the API process (single-service deploys). */
  INLINE_WORKER: z.string().default('true'),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(60 * 60 * 24 * 30),
  SECRETS_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i, '32-byte hex key required'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_PRIMARY_MODEL: z.string().default('claude-sonnet-4-6'),
  AI_FALLBACK_MODEL: z.string().default('gpt-4o'),
  AI_REVIEWER_MODEL: z.string().default('claude-haiku-4-5-20251001'),
  AI_IMAGE_MODEL: z.string().default('dall-e-3'),
  AI_MAX_REGEN_ATTEMPTS: z.coerce.number().default(3),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('forge'),
  S3_SECRET_KEY: z.string().default('forge-secret'),
  S3_BUCKET: z.string().default('forge-assets'),
  S3_REGION: z.string().default('us-east-1'),

  GITHUB_APP_TOKEN: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  NETLIFY_TOKEN: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),

  SENTRY_DSN_API: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Fail fast: a misconfigured instance must not boot.
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
