import { PublishRequest } from '../connectors/types';
import { GuardedPublishResult, GuardedPublishService } from '../rules/GuardedPublishService';
import { IdempotencyManager } from './idempotency/IdempotencyManager';
import { buildIdempotencyScope } from './idempotency/hash';
import { RetryPolicy } from './retry/RetryPolicy';
import { AmbiguousOutcomeError, RetryOptions } from './retry/types';

export interface ReliablePublishOptions {
  idempotencyKey?: string;
  retryOptions?: Partial<RetryOptions>;
}

export interface ReliablePublishResult extends GuardedPublishResult {
  isCached?: boolean;
}

/**
 * Orchestrating service that provides idempotent execution, safe bounded retries,
 * and posting-rule enforcement for destination publishing.
 */
export class ReliablePublishService {
  constructor(
    private guardedPublishService: GuardedPublishService,
    private idempotencyManager: IdempotencyManager,
    private retryPolicy: RetryPolicy
  ) {}

  /**
   * Publish content reliably with idempotency and safe retry policies.
   */
  public async publish(
    request: PublishRequest,
    options: ReliablePublishOptions = {}
  ): Promise<ReliablePublishResult> {
    const operation = async (): Promise<GuardedPublishResult> => {
      return this.retryPolicy.execute(
        async () => {
          const outcome = await this.guardedPublishService.publish(request);

          // 1. Posting-rule violations are permanent: never retry
          if (outcome.decision === 'blocked') {
            return outcome;
          }

          // 2. Explicitly handle connector errors
          if (!outcome.success && outcome.error) {
            const code = outcome.error.code;

            if (code === 'AMBIGUOUS_OUTCOME' || (outcome.error.details as any)?.isAmbiguous) {
              throw new AmbiguousOutcomeError(request.destinationKey, outcome.error);
            }

            // Transient connector errors throw to trigger retry policy
            if (
              code === 'NETWORK_TIMEOUT' ||
              code === 'RATE_LIMITED' ||
              code === 'TRANSIENT_ERROR'
            ) {
              const transientErr = new Error(outcome.error.message);
              (transientErr as any).code = code;
              (transientErr as any).isTransient = true;
              throw transientErr;
            }

            // Permanent errors (invalid request, unsupported, etc.) return without retrying
            return outcome;
          }

          return outcome;
        },
        options.retryOptions
      );
    };

    // If an idempotency key is provided, execute within idempotency manager
    if (options.idempotencyKey && options.idempotencyKey.trim()) {
      const scope = buildIdempotencyScope(
        request.destinationKey,
        'publish',
        options.idempotencyKey
      );

      const idempotencyResult = await this.idempotencyManager.execute(
        scope,
        options.idempotencyKey,
        request,
        operation
      );

      return {
        ...idempotencyResult.result,
        isCached: idempotencyResult.isCached,
      };
    }

    // Direct execution without idempotency key
    const directResult = await operation();
    return {
      ...directResult,
      isCached: false,
    };
  }
}
