import { IdempotencyRecord, IdempotencyStore } from './types';

/**
 * In-memory idempotency store for local operation, tests, and single-process execution.
 *
 * NOTE / LIMITATION:
 * This in-memory implementation does not survive process restarts or scale across multiple
 * node cluster processes. For distributed high-availability production deployments, a durable
 * persistence adapter (e.g. Redis, PostgreSQL) is required.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();

  public get(scope: string): IdempotencyRecord | null {
    const record = this.records.get(scope);
    if (!record) return null;
    return { ...record };
  }

  public create(record: IdempotencyRecord): void {
    this.records.set(record.scope, {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  public update(scope: string, updates: Partial<IdempotencyRecord>): void {
    const existing = this.records.get(scope);
    if (!existing) return;

    this.records.set(scope, {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    });
  }

  public clear(): void {
    this.records.clear();
  }
}
