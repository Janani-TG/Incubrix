import { AppError } from '../../errors/AppError';

/**
 * Thrown when an idempotency key is reused with a materially different request payload.
 */
export class IdempotencyConflictError extends AppError {
  public readonly code = 'IDEMPOTENCY_CONFLICT';
  public readonly key: string;
  public readonly scope: string;

  constructor(key: string, scope: string, message?: string) {
    super(
      message ||
        `Idempotency key '${key}' was previously used with a materially different request payload.`,
      409
    );
    this.name = 'IdempotencyConflictError';
    this.key = key;
    this.scope = scope;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
