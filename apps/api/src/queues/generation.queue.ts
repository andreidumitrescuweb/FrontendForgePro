import { Queue } from 'bullmq';
import { bullConnectionOptions } from '../lib/redis';

export interface GenerationJobData {
  jobId: string; // GenerationJob row id
  projectId: string;
  userId: string;
}

export const GENERATION_QUEUE = 'generation';

export const generationQueue = new Queue<GenerationJobData>(GENERATION_QUEUE, {
  connection: bullConnectionOptions(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
