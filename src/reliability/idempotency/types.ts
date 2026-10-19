/**
 * Lifecycle status of an idempotency record.
 */
export type IdempotencyRecordStatus = 'pending' | 'completed' | 'failed';

/**
 * Persisted idempotency record representing a unique scoped operation.
 */
export interface IdempotencyRecord<TResult = unknown> {
  key: string;
  scope: string;
  requestHash: string;
  status: IdempotencyRecordStatus;
  result?: TResult;
  error?: {
    code: string;
    message: string;
    statusCode?: number;
    details?: Record<string, unknown>;
  };
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

/**
 * Storage contract for idempotency records.
 */
export interface IdempotencyStore {
  get(scope: string): Promise<IdempotencyRecord | null> | IdempotencyRecord | null;
  create(record: IdempotencyRecord): Promise<void> | void;
  update(scope: string, updates: Partial<IdempotencyRecord>): Promise<void> | void;
  clear(): Promise<void> | void;
}
