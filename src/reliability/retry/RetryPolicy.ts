import { Delayer, RealDelayer } from './delayer';
import {
  AmbiguousOutcomeError,
  RetryExhaustedError,
  RetryOptions,
} from './types';
import { classifyError } from './classification';

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialBackoffMs: 200,
  maxBackoffMs: 2000,
  backoffMultiplier: 2,
};

/**
 * Executes operations with bounded retries and exponential backoff based on error classification.
 */
export class RetryPolicy {
  constructor(
    private delayer: Delayer = new RealDelayer(),
    private defaultOptions: RetryOptions = DEFAULT_RETRY_OPTIONS
  ) {}

  public async execute<T>(
    operation: (attempt: number) => Promise<T>,
    options?: Partial<RetryOptions>
  ): Promise<T> {
    const opts: RetryOptions = {
      ...this.defaultOptions,
      ...options,
    };

    let attempt = 1;
    let lastError: unknown;

    while (attempt <= opts.maxAttempts) {
      try {
        return await operation(attempt);
      } catch (err: unknown) {
        lastError = err;
        const classification = classifyError(err);

        // 1. Permanent errors must never be retried
        if (classification.classification === 'permanent') {
          throw err;
        }

        // 2. Ambiguous outcomes cannot be retried without reconciliation
        if (classification.classification === 'ambiguous') {
          if (err instanceof AmbiguousOutcomeError) {
            throw err;
          }
          throw new AmbiguousOutcomeError(undefined, err);
        }

        // 3. Transient error: check attempt bounds
        if (attempt >= opts.maxAttempts) {
          throw new RetryExhaustedError(attempt, lastError);
        }

        // Calculate backoff
        const backoffMs = Math.min(
          opts.maxBackoffMs,
          opts.initialBackoffMs * Math.pow(opts.backoffMultiplier, attempt - 1)
        );

        await this.delayer.delay(backoffMs);
        attempt++;
      }
    }

    throw new RetryExhaustedError(attempt, lastError);
  }
}
