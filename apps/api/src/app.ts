import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as Sentry from '@sentry/node';
import { env } from './config/env';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { oauthRouter } from './modules/auth/oauth.routes';
import { workspaceRouter } from './modules/workspaces/workspace.routes';
import { projectRouter } from './modules/projects/project.routes';
import { billingRouter } from './modules/billing/billing.routes';
import { stripeWebhookHandler } from './modules/billing/webhook';
import { marketplaceRouter } from './modules/marketplace/marketplace.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { deployRouter } from './modules/deployments/deploy.routes';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';

export function createApp(): Express {
  if (env.SENTRY_DSN_API) {
    Sentry.init({ dsn: env.SENTRY_DSN_API, environment: env.NODE_ENV });
  }

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // analytics script + assets
    }),
  );

  // Restrictive CORS: only the web app, with credentials for the refresh cookie.
  // The analytics ingest/script endpoints are deliberately open (see below).
  const restrictiveCors = cors({ origin: env.WEB_URL, credentials: true });

  // Stripe webhook needs the raw body — mount before express.json().
  app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

  // Public analytics: open CORS, text bodies from sendBeacon.
  app.use('/api/v1/analytics/ingest', cors(), express.text({ type: '*/*', limit: '10kb' }));
  app.use('/api/v1/analytics/script.js', cors());

  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  // Health & readiness probes.
  app.get('/healthz', (_req, res) => res.json({ ok: true }));
  app.get('/readyz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      res.json({ ok: true });
    } catch (err) {
      res.status(503).json({ ok: false, error: String(err) });
    }
  });

  // Stats endpoint is consumed by the web app — needs credentialed CORS.
  app.use('/api/v1/analytics/projects', restrictiveCors);
  app.use('/api/v1/analytics', analyticsRouter); // ingest + script.js are public

  app.use(restrictiveCors);
  app.use(globalLimiter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/oauth', oauthRouter);
  app.use('/api/v1/workspaces', workspaceRouter);
  app.use('/api/v1/projects', projectRouter);
  app.use('/api/v1/billing', billingRouter);
  app.use('/api/v1/marketplace', marketplaceRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/chat', chatRouter);
  app.use('/api/v1', deployRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
