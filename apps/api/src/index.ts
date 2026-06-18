import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { generationQueue } from './queues/generation.queue';
import { attachCollabServer } from './realtime/collab';
import { attachChatServer } from './realtime/chat';

const app = createApp();
const server = http.createServer(app);

attachCollabServer(server);
const io = attachChatServer(server);

server.listen(env.API_PORT, () => {
  logger.info(`FrontendForge API listening on :${env.API_PORT}`, { env: env.NODE_ENV });
});

// Graceful shutdown: stop accepting, drain, close dependencies.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);
  const timeout = setTimeout(() => {
    logger.error('Forced shutdown after 15s');
    process.exit(1);
  }, 15000);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await io.close();
  await generationQueue.close();
  await prisma.$disconnect();
  redis.disconnect();
  clearTimeout(timeout);
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
