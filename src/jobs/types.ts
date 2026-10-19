/**
 * State transitions: queued -> running -> succeeded | failed
 */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/**
 * Common background job representation.
 */
export interface Job<TData = unknown, TResult = unknown> {
  id: string;
  type: string;
  destinationKey: string;
  idempotencyKey?: string;
  data: TData;
  status: JobStatus;
  result?: TResult;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  attempts: number;
  maxAttempts: number;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  executionDurationMs?: number;
}

/**
 * Storage contract for background jobs.
 */
export interface JobStore {
  create(job: Job): Promise<void> | void;
  get(id: string): Promise<Job | null> | Job | null;
  update(id: string, updates: Partial<Job>): Promise<void> | void;
  getNextQueued(): Promise<Job | null> | Job | null;
  getAll(): Promise<Job[]> | Job[];
  clear(): Promise<void> | void;
}
