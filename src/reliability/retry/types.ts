import { AppError } from '../../errors/AppError';

export type ErrorClassification = 'transient' | 'permanent' | 'ambiguous';

export interface ClassifiedError {
  classification: ErrorClassification;
  reason: string;
  isRetryable: boolean;
}

export interface RetryOptions {
  maxAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  backoffMultiplier: number;
}

export class RetryExhaustedError extends AppError {
  public readonly code = 'RETRY_EXHAUSTED';
  public readonly attempts: number;
  public readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown, message?: string) {
    super(
      message ||
        `Operation failed after ${attempts} retry attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      502
    );
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.lastError = lastError;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AmbiguousOutcomeError extends AppError {
  public readonly code = 'AMBIGUOUS_OUTCOME';
  public readonly destinationKey?: string;
  public readonly originalError: unknown;

  constructor(destinationKey?: string, originalError?: unknown, message?: string) {
    super(
      message ||
        `Operation outcome is ambiguous for destination '${destinationKey ?? 'unknown'}'. Automatic retry halted to prevent duplicate publication.`,
      502
    );
    this.name = 'AmbiguousOutcomeError';
    this.destinationKey = destinationKey;
    this.originalError = originalError;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
