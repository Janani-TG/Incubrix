import { ClassifiedError } from './types';

/**
 * Classifies an error as transient (retryable), permanent (non-retryable), or ambiguous.
 */
export function classifyError(error: unknown): ClassifiedError {
  if (!error) {
    return {
      classification: 'permanent',
      reason: 'Empty error',
      isRetryable: false,
    };
  }

  const errObj = error as Record<string, unknown>;
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  const statusCode = typeof errObj.statusCode === 'number' ? errObj.statusCode : undefined;
  const message = typeof errObj.message === 'string' ? errObj.message.toLowerCase() : '';

  // 1. Ambiguous errors: outcome cannot be confirmed without reconciliation
  if (
    code === 'AMBIGUOUS_OUTCOME' ||
    code === 'TIMEOUT_DURING_DISPATCH' ||
    errObj.isAmbiguous === true
  ) {
    return {
      classification: 'ambiguous',
      reason: 'Network disconnect or timeout occurred during dispatch; remote state unknown.',
      isRetryable: false,
    };
  }

  // 2. Permanent errors: validation, rule violations, unsupported capabilities, auth, client errors
  const permanentCodes = [
    'RULE_VIOLATION',
    'UNSUPPORTED_CAPABILITY',
    'INVALID_REQUEST',
    'VALIDATION_ERROR',
    'IDEMPOTENCY_CONFLICT',
    'DUPLICATE_CONNECTOR',
    'CONNECTOR_NOT_FOUND',
    'SIMULATION_NOT_SUPPORTED',
  ];

  if (permanentCodes.includes(code)) {
    return {
      classification: 'permanent',
      reason: `Permanent error code '${code}' cannot be resolved by retrying.`,
      isRetryable: false,
    };
  }

  if (
    statusCode !== undefined &&
    [400, 401, 403, 404, 405, 409, 422, 501].includes(statusCode)
  ) {
    return {
      classification: 'permanent',
      reason: `HTTP ${statusCode} client/configuration error is permanent.`,
      isRetryable: false,
    };
  }

  // Explicit flag
  if (errObj.isPermanent === true) {
    return {
      classification: 'permanent',
      reason: 'Error explicitly marked as permanent.',
      isRetryable: false,
    };
  }

  // 3. Transient errors: rate limits, gateway errors, timeouts, transient network drops
  const transientCodes = [
    'RATE_LIMITED',
    'NETWORK_TIMEOUT',
    'TRANSIENT_ERROR',
    'SERVICE_UNAVAILABLE',
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
  ];

  if (transientCodes.includes(code)) {
    return {
      classification: 'transient',
      reason: `Transient error code '${code}' is eligible for retry.`,
      isRetryable: true,
    };
  }

  if (statusCode !== undefined && [429, 502, 503, 504].includes(statusCode)) {
    return {
      classification: 'transient',
      reason: `HTTP ${statusCode} server/network status is transient.`,
      isRetryable: true,
    };
  }

  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('rate limit')
  ) {
    return {
      classification: 'transient',
      reason: 'Transient network or rate-limiting pattern in message.',
      isRetryable: true,
    };
  }

  if (errObj.isTransient === true) {
    return {
      classification: 'transient',
      reason: 'Error explicitly marked as transient.',
      isRetryable: true,
    };
  }

  // Default: unclassified errors are treated as permanent to avoid runaway retry loops
  return {
    classification: 'permanent',
    reason: 'Unclassified error treated as non-retryable by default.',
    isRetryable: false,
  };
}
