import { startGenerationWorker } from './queues/generation.worker';
import { prisma } from './lib/prisma';

/**
 * Dedicated worker entry point (docker-compose `worker` service or
 * `npm run worker -w apps/api`). For single-service deploys the same worker is
 * started in-process by the API (see src/index.ts and env INLINE_WORKER).
 */
const worker = startGenerationWorker();

async function shutdown(): Promise<void> {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
