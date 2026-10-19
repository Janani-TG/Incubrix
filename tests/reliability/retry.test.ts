import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryPolicy } from '../../src/reliability/retry/RetryPolicy';
import { NoOpDelayer } from '../../src/reliability/retry/delayer';
import { classifyError } from '../../src/reliability/retry/classification';
import {
  AmbiguousOutcomeError,
  RetryExhaustedError,
} from '../../src/reliability/retry/types';

describe('Safe Retries and Error Classification', () => {
  let delayer: NoOpDelayer;
  let policy: RetryPolicy;

  beforeEach(() => {
    delayer = new NoOpDelayer();
    policy = new RetryPolicy(delayer, {
      maxAttempts: 3,
      initialBackoffMs: 100,
      maxBackoffMs: 1000,
      backoffMultiplier: 2,
    });
  });

  describe('Error Classification', () => {
    it('should classify rule violations and validation errors as permanent', () => {
      expect(classifyError({ code: 'RULE_VIOLATION' }).classification).toBe('permanent');
      expect(classifyError({ code: 'UNSUPPORTED_CAPABILITY' }).classification).toBe('permanent');
      expect(classifyError({ code: 'INVALID_REQUEST' }).classification).toBe('permanent');
      expect(classifyError({ statusCode: 400 }).classification).toBe('permanent');
      expect(classifyError({ statusCode: 404 }).classification).toBe('permanent');
      expect(classifyError({ isRetryable: false }).isRetryable).toBe(false);
    });

    it('should classify rate limits and gateway timeouts as transient', () => {
      expect(classifyError({ code: 'RATE_LIMITED' }).classification).toBe('transient');
      expect(classifyError({ code: 'NETWORK_TIMEOUT' }).classification).toBe('transient');
      expect(classifyError({ statusCode: 429 }).classification).toBe('transient');
      expect(classifyError({ statusCode: 503 }).classification).toBe('transient');
      expect(classifyError({ isTransient: true }).isRetryable).toBe(true);
    });

    it('should classify unknown network drops as ambiguous', () => {
      expect(classifyError({ code: 'AMBIGUOUS_OUTCOME' }).classification).toBe('ambiguous');
      expect(classifyError({ code: 'TIMEOUT_DURING_DISPATCH' }).classification).toBe('ambiguous');
      expect(classifyError({ isAmbiguous: true }).classification).toBe('ambiguous');
    });
  });

  describe('Transient Failure Followed by Success', () => {
    it('should retry transient errors with backoff and succeed', async () => {
      let attempts = 0;
      const transientAction = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 2) {
          const err = new Error('Gateway Timeout');
          (err as any).statusCode = 504;
          throw err;
        }
        return { success: true, attempts };
      });

      const result = await policy.execute(transientAction);

      expect(result).toEqual({ success: true, attempts: 2 });
      expect(transientAction).toHaveBeenCalledTimes(2);

      // Backoff delay of 100ms was recorded without real waiting
      expect(delayer.recordedDelays).toEqual([100]);
    });
  });

  describe('Permanent Failure with No Retry', () => {
    it('should immediately fail on permanent error without retrying', async () => {
      const permanentAction = vi.fn().mockImplementation(async () => {
        const err = new Error('Rule Violation');
        (err as any).code = 'RULE_VIOLATION';
        throw err;
      });

      await expect(policy.execute(permanentAction)).rejects.toThrow('Rule Violation');

      // Permanent error must NOT be retried
      expect(permanentAction).toHaveBeenCalledTimes(1);
      expect(delayer.recordedDelays).toHaveLength(0);
    });
  });

  describe('Retry Exhaustion', () => {
    it('should throw RetryExhaustedError when transient failures exceed maxAttempts', async () => {
      const failingAction = vi.fn().mockImplementation(async () => {
        const err = new Error('503 Service Unavailable');
        (err as any).statusCode = 503;
        throw err;
      });

      await expect(policy.execute(failingAction)).rejects.toThrow(RetryExhaustedError);

      // Called exactly maxAttempts (3) times
      expect(failingAction).toHaveBeenCalledTimes(3);

      // Exponential backoffs: 100ms, 200ms
      expect(delayer.recordedDelays).toEqual([100, 200]);
    });
  });

  describe('Ambiguous Outcome Handling', () => {
    it('should halt automatic retry when outcome is ambiguous to prevent duplicate publication', async () => {
      const ambiguousAction = vi.fn().mockImplementation(async () => {
        const err = new Error('Connection reset after dispatch');
        (err as any).code = 'AMBIGUOUS_OUTCOME';
        throw err;
      });

      await expect(policy.execute(ambiguousAction)).rejects.toThrow(AmbiguousOutcomeError);

      // Ambiguous error must NOT be retried automatically
      expect(ambiguousAction).toHaveBeenCalledTimes(1);
      expect(delayer.recordedDelays).toHaveLength(0);
    });
  });
});
