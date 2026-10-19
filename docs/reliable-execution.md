# Reliable Execution: Idempotency, Retries, and Background Jobs

This document details Stage 4 architecture covering idempotency contracts, retry safety, error classification, and background job handling for the IncuBrix Long-Tail Distribution Destination Network.

---

## 1. Idempotency Contract

### Scoping
Idempotency keys are explicitly scoped by destination, operation, and client key:
```
{destinationKey}:{operation}:{idempotencyKey}
```
*Example*: `devto:publish:client-post-42`

### Payload Hashing
- Request payloads are canonicalized (keys sorted recursively) and hashed using SHA-256 (`computePayloadHash`).
- **Same key + same payload**: Returns the previously completed result with `isCached: true` without invoking the publishing pipeline or destination connector.
- **Same key + materially different payload**: Immediately rejected with `IdempotencyConflictError` (HTTP 409 Conflict).
- **Concurrent requests**: Multiple simultaneous in-flight requests with the same key and payload are synchronized via in-flight promise locks, ensuring exactly one underlying execution occurs.

---

## 2. Safe Retries and Error Classification

All errors are classified into three distinct categories before retry decisions are made:

| Error Category | Criteria | Action |
| :--- | :--- | :--- |
| **Permanent** | 4xx client errors, validation failures, posting-rule violations (`RULE_VIOLATION`), unsupported capabilities (`UNSUPPORTED_CAPABILITY`), 409 conflicts. | **Never retried**. Immediately bubbles up. |
| **Transient** | 429 rate limits, 502/503/504 gateway errors, connection resets (`ECONNRESET`, `ETIMEDOUT`). | Retried with bounded attempts and exponential backoff (`delayer.delay()`). |
| **Ambiguous** | Network timeouts occurring during socket dispatch or when receipt cannot be verified (`AMBIGUOUS_OUTCOME`). | **Never automatically retried**. Halts to prevent duplicate posts on destinations lacking reconciliation. |

### Backoff and Zero-Waiting Tests
- Exponential backoff is calculated as:
  $$\text{backoff} = \min(\text{maxBackoffMs}, \text{initialBackoffMs} \times \text{multiplier}^{\text{attempt}-1})$$
- Automated tests inject `NoOpDelayer`, ensuring retry logic is fully verified without real-time sleep intervals.

---

## 3. Background Jobs

### Job States
Background jobs follow explicit lifecycle states:
$$\text{queued} \longrightarrow \text{running} \longrightarrow \text{succeeded} \mid \text{failed}$$

Every job maintains timestamps (`queuedAt`, `startedAt`, `completedAt`, `failedAt`), attempt counts, execution duration (`executionDurationMs`), and structured error payloads.

### Two-Second Threshold Compatibility
`JobService.executeWithThreshold()` enables synchronous execution while enforcing the assessment requirement that operations exceeding two seconds (or long-running batches) transition into background jobs.

---

## 4. Safety Integration Guarantees

1. **Posting Rules Primacy**: `GuardedPublishService` evaluates destination policies before any connector dispatch. Blocked content returns `{ decision: 'blocked' }` and is **guaranteed never to invoke connector publishing**.
2. **Idempotency Integration**: Blocked rule evaluations are cached in the idempotency store, ensuring subsequent duplicate calls return the same blocked decision without re-evaluating rules or calling connectors.
3. **Simulation Isolation**: `simulate: true` undergoes full rule validation and deterministic mock simulation, but **never persists external content or records into publication history**.

---

## 5. Assumptions and Known Limitations

> [!WARNING]
> **In-Memory Storage Limitation**: In this stage, `InMemoryIdempotencyStore` and `InMemoryJobStore` store state in process memory. They do not survive application restarts and do not synchronize across multiple Node.js cluster processes. In production, these interfaces must be backed by persistent stores such as Redis or PostgreSQL.
>
> **Ambiguous Reconciliation**: When network connections drop mid-flight, outcome state is marked ambiguous. Automatic retries are prevented until destination connectors implement verifiable inquiry methods (`verify()` / `getStatus()`).
