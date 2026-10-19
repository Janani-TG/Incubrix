import crypto from 'crypto';

/**
 * Build an explicit scoped key: {destinationKey}:{operation}:{idempotencyKey}
 */
export function buildIdempotencyScope(
  destinationKey: string,
  operation: string,
  idempotencyKey: string
): string {
  const dest = (destinationKey || '').trim().toLowerCase();
  const op = (operation || '').trim().toLowerCase();
  const key = (idempotencyKey || '').trim();
  return `${dest}:${op}:${key}`;
}

/**
 * Deep-sort object keys to produce deterministic JSON serialization regardless of property order.
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    result[k] = canonicalize(obj[k]);
  }
  return result;
}

/**
 * Deterministically compute a SHA-256 hex digest of any request payload.
 */
export function computePayloadHash(payload: unknown): string {
  const canonical = canonicalize(payload);
  const serialized = JSON.stringify(canonical);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}
