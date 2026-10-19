import { Job, JobStore } from './types';

export type JobHandler<TData = unknown, TResult = unknown> = (
  job: Job<TData, TResult>
) => Promise<TResult>;

/**
 * Worker that processes queued background jobs and records execution lifecycle state.
 */
export class JobWorker {
  private handlers = new Map<string, JobHandler<any, any>>();

  constructor(private store: JobStore) {}

  public registerHandler<TData, TResult>(
    type: string,
    handler: JobHandler<TData, TResult>
  ): void {
    this.handlers.set(type, handler);
  }

  /**
   * Process a specific job by ID through state transitions: queued -> running -> succeeded | failed.
   */
  public async processJob(jobId: string): Promise<Job> {
    const job = await this.store.get(jobId);
    if (!job) {
      throw new Error(`Job '${jobId}' not found.`);
    }

    const handler = this.handlers.get(job.type);
    if (!handler) {
      const errorDetail = {
        code: 'NO_HANDLER',
        message: `No handler registered for job type '${job.type}'.`,
      };
      await this.store.update(jobId, {
        status: 'failed',
        error: errorDetail,
        failedAt: new Date(),
      });
      return (await this.store.get(jobId))!;
    }

    const startedAt = new Date();
    await this.store.update(jobId, {
      status: 'running',
      startedAt,
      attempts: job.attempts + 1,
    });

    try {
      const result = await handler(job);
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      await this.store.update(jobId, {
        status: 'succeeded',
        result,
        completedAt,
        executionDurationMs: durationMs,
      });
    } catch (err: unknown) {
      const failedAt = new Date();
      const durationMs = failedAt.getTime() - startedAt.getTime();
      const errObj =
        err instanceof Error
          ? {
              code: (err as { code?: string }).code || 'JOB_EXECUTION_ERROR',
              message: err.message,
              details: (err as { details?: Record<string, unknown> }).details,
            }
          : { code: 'JOB_EXECUTION_ERROR', message: String(err) };

      await this.store.update(jobId, {
        status: 'failed',
        error: errObj,
        failedAt,
        executionDurationMs: durationMs,
      });
    }

    return (await this.store.get(jobId))!;
  }

  /**
   * Fetch and execute the next eligible queued job.
   */
  public async processNext(): Promise<Job | null> {
    const nextJob = await this.store.getNextQueued();
    if (!nextJob) return null;

    return this.processJob(nextJob.id);
  }

  /**
   * Process all currently queued jobs sequentially.
   */
  public async processAll(): Promise<Job[]> {
    const processed: Job[] = [];
    let job: Job | null;
    while ((job = await this.processNext()) !== null) {
      processed.push(job);
    }
    return processed;
  }
}
