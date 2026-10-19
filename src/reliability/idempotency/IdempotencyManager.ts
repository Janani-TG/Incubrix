import { IdempotencyStore } from './types';
import { IdempotencyConflictError } from './errors';
import { computePayloadHash } from './hash';

export interface IdempotencyExecutionResult<T> {
  isCached: boolean;
  result: T;
}

/**
 * Manages idempotent execution, payload comparison, deduplication, and concurrent request synchronization.
 */
export class IdempotencyManager {
  // In-flight promise locks for single-process concurrency control
  private inFlight = new Map<string, Promise<unknown>>();

  constructor(private store: IdempotencyStore) {}

  /**
   * Execute an action idempotently under the specified scope.
   * If a previous execution succeeded with the same payload, returns the cached result.
   * If an execution is currently in-flight with the same payload, awaits it concurrently.
   * If a request is received with the same key but a different payload, throws IdempotencyConflictError.
   */
  public async execute<T>(
    scope: string,
    key: string,
    payload: unknown,
    action: () => Promise<T>
  ): Promise<IdempotencyExecutionResult<T>> {
    const currentHash = computePayloadHash(payload);

    // 1. Synchronously check if an execution is already in flight for this scope
    const running = this.inFlight.get(scope);
    if (running) {
      const sharedResult = (await running) as T;
      return {
        isCached: true,
        result: sharedResult,
      };
    }

    // 2. Synchronously register the in-flight promise before yielding to the event loop
    let isOriginallyCached = false;

    const executionPromise = (async (): Promise<T> => {
      // Check existing record in store
      const existing = await this.store.get(scope);
      if (existing) {
        if (existing.requestHash !== currentHash) {
          throw new IdempotencyConflictError(key, scope);
        }

        if (existing.status === 'completed' && existing.result !== undefined) {
          isOriginallyCached = true;
          return existing.result as T;
        }
      }

      // Mark record as pending
      const now = new Date();
      if (!existing) {
        await this.store.create({
          key,
          scope,
          requestHash: currentHash,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await this.store.update(scope, { status: 'pending', updatedAt: now });
      }

      try {
        const result = await action();
        await this.store.update(scope, {
          status: 'completed',
          result,
          updatedAt: new Date(),
        });
        return result;
      } catch (err: unknown) {
        const errObj =
          err instanceof Error
            ? {
                code: (err as { code?: string }).code || 'EXECUTION_FAILED',
                message: err.message,
                statusCode: (err as { statusCode?: number }).statusCode,
              }
            : { code: 'UNKNOWN_ERROR', message: String(err) };

        await this.store.update(scope, {
          status: 'failed',
          error: errObj,
          updatedAt: new Date(),
        });
        throw err;
      }
    })();

    this.inFlight.set(scope, executionPromise);

    try {
      const result = await executionPromise;
      return {
        isCached: isOriginallyCached,
        result,
      };
    } finally {
      this.inFlight.delete(scope);
    }
  }
}
