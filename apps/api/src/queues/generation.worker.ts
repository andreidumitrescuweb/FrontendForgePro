import { Worker, type Job } from 'bullmq';
import type { GenerationStatus, ProjectBrief } from '@forge/shared';
import { GENERATION_QUEUE, type GenerationJobData } from './generation.queue';
import { bullConnectionOptions } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { runGenerationPipeline } from '../services/ai/pipeline';
import { createVersion } from '../modules/projects/version.service';
import { getWorkspaceLimits } from '../modules/workspaces/workspace.service';

/**
 * Starts the BullMQ generation worker. Can run either inside the API process
 * (single-service deploys like Railway) or as a dedicated process
 * (docker-compose `worker` service). Returns the Worker so callers can close it.
 */
export function startGenerationWorker(): Worker<GenerationJobData> {
  const worker = new Worker<GenerationJobData>(
    GENERATION_QUEUE,
    async (job: Job<GenerationJobData>) => {
      const { jobId, projectId, userId } = job.data;
      logger.info('Generation job started', { jobId, projectId });

      const dbJob = await prisma.generationJob.findUniqueOrThrow({ where: { id: jobId } });
      const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
      const limits = await getWorkspaceLimits(project.workspaceId);

      const setStatus = async (status: string): Promise<void> => {
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { status: status as GenerationStatus },
        });
      };

      try {
        const result = await runGenerationPipeline(
          projectId,
          dbJob.input as unknown as ProjectBrief,
          setStatus,
          { watermark: limits.watermark, analyticsKey: project.analyticsKey },
        );
        const version = await createVersion({
          projectId,
          bundle: result.bundle,
          label: `AI generation (${result.modelUsed}, ${result.attempts} attempt${result.attempts > 1 ? 's' : ''})`,
          createdById: userId,
        });
        await prisma.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            attempts: result.attempts,
            result: {
              versionId: version.id,
              report: result.report,
              reviewerNotes: result.reviewerNotes,
              modelUsed: result.modelUsed,
            } as object,
            finishedAt: new Date(),
          },
        });
        logger.info('Generation job completed', { jobId, versionId: version.id });
      } catch (err) {
        await prisma.generationJob.update({
          where: { id: jobId },
          data: { status: 'FAILED', error: String(err), finishedAt: new Date() },
        });
        throw err; // let BullMQ apply retry policy
      }
    },
    {
      connection: bullConnectionOptions(),
      concurrency: 3,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Generation job failed', { jobId: job?.data.jobId, err: String(err) });
  });

  logger.info('Generation worker online', { queue: GENERATION_QUEUE, concurrency: 3 });
  return worker;
}
