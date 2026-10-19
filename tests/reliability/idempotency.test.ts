import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryIdempotencyStore } from '../../src/reliability/idempotency/store';
import { IdempotencyManager } from '../../src/reliability/idempotency/IdempotencyManager';
import { IdempotencyConflictError } from '../../src/reliability/idempotency/errors';
import { buildIdempotencyScope } from '../../src/reliability/idempotency/hash';

describe('Idempotency System', () => {
  let store: InMemoryIdempotencyStore;
  let manager: IdempotencyManager;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
    manager = new IdempotencyManager(store);
  });

  describe('Scope Building', () => {
    it('should explicitly scope keys by destination and operation', () => {
      const scope1 = buildIdempotencyScope('devto', 'publish', 'key-123');
      const scope2 = buildIdempotencyScope('medium', 'publish', 'key-123');
      const scope3 = buildIdempotencyScope('devto', 'delete', 'key-123');

      expect(scope1).toBe('devto:publish:key-123');
      expect(scope2).toBe('medium:publish:key-123');
      expect(scope3).toBe('devto:delete:key-123');
      expect(scope1).not.toBe(scope2);
      expect(scope1).not.toBe(scope3);
    });
  });

  describe('Same Key and Same Payload', () => {
    it('should return cached result without duplicate execution on repeated identical requests', async () => {
      const scope = buildIdempotencyScope('mock', 'publish', 'req-abc');
      const payload = { title: 'Hello World', body: 'Post content' };
      const actionSpy = vi.fn().mockResolvedValue({ id: 'res-1', status: 'published' });

      // First execution: executes action
      const first = await manager.execute(scope, 'req-abc', payload, actionSpy);
      expect(first.isCached).toBe(false);
      expect(first.result).toEqual({ id: 'res-1', status: 'published' });
      expect(actionSpy).toHaveBeenCalledTimes(1);

      // Second execution with identical payload: returns cached outcome
      const second = await manager.execute(scope, 'req-abc', payload, actionSpy);
      expect(second.isCached).toBe(true);
      expect(second.result).toEqual({ id: 'res-1', status: 'published' });
      expect(actionSpy).toHaveBeenCalledTimes(1); // STILL 1, never re-executed!
    });
  });

  describe('Same Key and Different Payload', () => {
    it('should reject reuse of an idempotency key with a materially different payload', async () => {
      const scope = buildIdempotencyScope('mock', 'publish', 'req-conflict');
      const initialPayload = { title: 'First Title', body: 'Content A' };
      const differentPayload = { title: 'Second Title', body: 'Content B' };

      const action = vi.fn().mockResolvedValue({ success: true });

      // First request succeeds
      await manager.execute(scope, 'req-conflict', initialPayload, action);

      // Second request with different payload throws 409 IdempotencyConflictError
      await expect(
        manager.execute(scope, 'req-conflict', differentPayload, action)
      ).rejects.toThrow(IdempotencyConflictError);

      try {
        await manager.execute(scope, 'req-conflict', differentPayload, action);
      } catch (err) {
        const conflictErr = err as IdempotencyConflictError;
        expect(conflictErr.code).toBe('IDEMPOTENCY_CONFLICT');
        expect(conflictErr.statusCode).toBe(409);
        expect(conflictErr.key).toBe('req-conflict');
      }

      // Action was only called once
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  describe('Concurrent Duplicate Requests', () => {
    it('should synchronize concurrent duplicate requests and execute underlying action only once', async () => {
      const scope = buildIdempotencyScope('mock', 'publish', 'concurrent-key');
      const payload = { title: 'Concurrent Post', body: 'Testing race conditions' };

      let executionCount = 0;
      const delayedAction = async () => {
        executionCount++;
        // Small delay to simulate async work
        await new Promise((res) => setTimeout(res, 20));
        return { success: true, count: executionCount };
      };

      // Launch 3 concurrent requests simultaneously
      const [res1, res2, res3] = await Promise.all([
        manager.execute(scope, 'concurrent-key', payload, delayedAction),
        manager.execute(scope, 'concurrent-key', payload, delayedAction),
        manager.execute(scope, 'concurrent-key', payload, delayedAction),
      ]);

      // All 3 receive the same result
      expect(res1.result).toEqual({ success: true, count: 1 });
      expect(res2.result).toEqual({ success: true, count: 1 });
      expect(res3.result).toEqual({ success: true, count: 1 });

      // Exactly one execution occurred
      expect(executionCount).toBe(1);
    });
  });
});
