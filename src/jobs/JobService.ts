import crypto from 'crypto';
import { Job, JobStore } from './types';

export interface EnqueueJobOptions<TData = unknown> {
  type: string;
  destinationKey: string;
  data: TData;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export type ExecutionOutcome<T> =
  | { mode: 'sync'; result: T }
  | { mode: 'async'; job: Job };

/**
 * Service exposing job state management and timeout-based background job offloading.
 */
export class JobService {
  private sequence = 1;

  constructor(private store: JobStore) {}

  public async enqueue<TData>(options: EnqueueJobOptions<TData>): Promise<Job<TData>> {
    const id = `job-${Date.now()}-${this.sequence++}-${crypto.randomBytes(4).toString('hex')}`;
    const job: Job<TData> = {
      id,
      type: options.type,
      destinationKey: options.destinationKey,
      idempotencyKey: options.idempotencyKey,
      data: options.data,
      status: 'queued',
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      queuedAt: new Date(),
    };

    await this.store.create(job as Job);
    return job;
  }

  public async getJob(id: string): Promise<Job | null> {
    return this.store.get(id);
  }

  public async getAllJobs(): Promise<Job[]> {
    return this.store.getAll();
  }

  /**
   * Execute an operation synchronously with a deadline threshold.
   * If the operation completes within thresholdMs, returns { mode: 'sync', result }.
   * If the operation exceeds thresholdMs, offloads to a background job and returns { mode: 'async', job }.
   */
  public async executeWithThreshold<T>(
    operation: () => Promise<T>,
    thresholdMs: number,
    enqueueFallback: () => Promise<Job>
  ): Promise<ExecutionOutcome<T>> {
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
      timer = setTimeout(() => resolve({ isTimeout: true }), thresholdMs);
    });

    try {
      const outcome = await Promise.race([
        operation().then((res) => ({ isTimeout: false, result: res })),
        timeoutPromise,
      ]);

      if (!outcome.isTimeout) {
        return {
          mode: 'sync',
          result: outcome.result,
        };
      }

      // Deadline exceeded: offload to background job
      const job = await enqueueFallback();
      return {
        mode: 'async',
        job,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
