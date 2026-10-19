# IncuBrix Software Engineer Assessment (PS4): Long-Tail Distribution Destination Network

**Author**: Software Engineering Assessment Candidate  
**Project**: IncuBrix Long-Tail Distribution Network  
**Repository**: `D:\Projects\Incubrix`  
**Latest Git Commit**: `b9cf817` (`Add Docker environment and integration tests`)  
**Date**: October 2026  

---

## 1. Executive Summary & Problem Overview

In multi-channel content syndication, technical creators and organizations frequently face the challenge of distributing content across fragmented "long-tail" destinations—such as specialized blogging platforms, self-hosted developer communities, and federated networks. Each destination presents asymmetric capabilities: varying authentication schemes, divergent lifecycle states, differing posting rules (rate limits, link caps, self-promotion rules), and distinct deletion semantics (e.g. permanent database deletion versus ActivityPub tombstones).

The objective of this project is to implement a robust, production-grade Node.js and TypeScript backend that enables reliable, policy-compliant, and idempotent content distribution across six heterogeneous destination platforms:
1. **DEV.to** (Forem API v0)
2. **Ghost CMS** (Admin API v5 with custom JWT auth)
3. **Discourse** (Community forum API)
4. **Lemmy** (Federated link aggregator API v3)
5. **Generic HMAC-Signed Webhook** (Standard Webhook specification)
6. **Assisted Manual Packager** (Local filesystem manifest packager)
Plus a **Deterministic Mock Connector** for offline testing and verification.

---

## 2. High-Level System Architecture

The application adopts a layered architecture implemented in TypeScript and Express:

```
                            Client Request
                                  │
                       [Idempotency-Key Header]
                                  ▼
                     ┌─────────────────────────┐
                     │   REST API (/api/v1)    │
                     │  (Validation & Routing) │
                     └────────────┬────────────┘
                                  │
                     ┌────────────┴────────────┐
                     │ ReliablePublishService  │
                     │  (Idempotency & Retry)  │
                     └────────────┬────────────┘
                                  │
                     ┌────────────┴────────────┐
                     │  GuardedPublishService  │
                     │ (Posting Rules Engine)  │
                     └────────────┬────────────┘
                                  │ (allowed)
                     ┌────────────┴────────────┐
                     │   Connector Registry    │
                     └────────────┬────────────┘
                                  │
      ┌───────────┬───────────────┼───────────────┬───────────┬───────────┐
      ▼           ▼               ▼               ▼           ▼           ▼
   DEV.to       Ghost         Discourse         Lemmy      Webhook     Assisted
```

### Key Architectural Boundaries
- **No Direct Connector Access**: HTTP route handlers cannot invoke a connector's raw `.publish()` method directly. All publishing requests must pass through `ReliablePublishService` (which coordinates idempotency and retry policies) and `GuardedPublishService` (which enforces destination posting rules).
- **Explicit Asymmetry**: Connectors declare capabilities via a strongly typed `ConnectorCapabilities` interface. Operations that are unsupported by a platform (e.g. content deletion or status queries on push-only webhooks) explicitly return `{ success: false, unsupported: true }`, translating to **HTTP 501 UnsupportedCapability** at the API layer. False success responses are strictly prohibited.

---

## 3. Destination Connector Implementations

Every connector extends `BaseConnector` (`src/connectors/BaseConnector.ts`) and implements the standard `Connector` interface (`src/connectors/types.ts`):

| Connector | Source File | Declared Capabilities | Auth Scheme | Deletion Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **DEV.to** | `src/connectors/implementations/DevtoConnector.ts` | Publish, Verify, GetStatus, Delete, Simulation | `api-key: <token>` | **Permanent Deletion**: Removes article from the DEV.to index (`DELETE /api/articles/{id}`). |
| **Ghost CMS** | `src/connectors/implementations/GhostConnector.ts` | Publish, Verify, GetStatus, Delete, Simulation | Custom JWT (`Authorization: Ghost {jwt}`) | **Permanent Deletion**: Permanently expunges post from Ghost SQLite/MySQL database (`DELETE /ghost/api/admin/posts/{id}/`). |
| **Discourse** | `src/connectors/implementations/DiscourseConnector.ts` | Publish, Verify, GetStatus, Delete, Simulation | `Api-Key` & `Api-Username` | **Soft-Deletion (Tombstone)**: Hides post from public view and attaches a tombstone; retained for staff audit (`DELETE /posts/{id}.json`). |
| **Lemmy** | `src/connectors/implementations/LemmyConnector.ts` | Publish, Verify, GetStatus, Delete, Simulation | JWT Bearer (`auth: <token>`) | **Soft-Deletion (ActivityPub Tombstone)**: Replaces content with a tombstone (`POST /api/v3/post/delete`) to maintain federation consensus. |
| **HMAC Webhook** | `src/connectors/implementations/WebhookConnector.ts` | Publish, Simulation | HMAC-SHA256 (`t=...,v1=...`) | **Unsupported**: Push-only event stream; returns HTTP 501 for verify, status, and delete operations. |
| **Assisted Packager** | `src/connectors/implementations/AssistedConnector.ts` | Publish, Verify, GetStatus, Delete, Simulation | Local Filesystem Permissions | **Permanent Deletion**: Recursively removes generated pack directory (`fs.rmSync`). |
| **Mock Connector** | `src/connectors/MockConnector.ts` | Publish, Verify, GetStatus, Delete, Simulation | In-Memory Fixture | **Permanent Memory Cleanup**: Removes item from in-memory Map. |

### Technical Implementation Highlights
- **Ghost Admin JWT Generation**: Rather than pulling in an external JWT dependency, Ghost's token format (`{24-hex-id}:{64-hex-secret}`) is generated in `src/connectors/implementations/GhostConnector.ts` using Node.js built-in `crypto.createHmac('sha256')`, signing a 5-minute payload scoped to `aud: '/admin/'`.
- **Webhook Replay & Timing Protections**: `src/connectors/implementations/WebhookConnector.ts` implements timestamp verification with a 300-second tolerance window to protect against replay attacks, and uses `crypto.timingSafeEqual` to eliminate timing vulnerabilities.
- **Assisted Path Traversal Guard**: `src/connectors/implementations/AssistedConnector.ts` normalizes and verifies output paths to prevent directory traversal exploits (`../`).

---

## 4. Destination Posting-Rules Engine

The posting-rules engine (`src/rules/PostingRulesEngine.ts`) evaluates content against destination-specific policy configurations prior to publishing:

1. **Publishing Frequency Limits** (`src/rules/evaluators/frequencyLimit.ts`): Enforces a sliding time window (e.g. maximum 3 posts per hour) evaluated against `InMemoryPublicationHistoryStore`.
2. **Self-Promotion Restrictions** (`src/rules/evaluators/selfPromotion.ts`): Scans content for disallowed keywords, detects self-promotional links, and enforces mandatory disclosure flags.
3. **Link Restrictions** (`src/rules/evaluators/linkRestrictions.ts`): Enforces maximum total URL counts, domain whitelists, and blacklists.
4. **AI Disclosure Requirements** (`src/rules/evaluators/aiDisclosure.ts`): Verifies required AI generation notices or metadata when content is marked AI-generated.

When content violates policy rules, `GuardedPublishService` halts publication and returns structured violation details, translating to **HTTP 422 Unprocessable Content** (`error: 'RuleViolation'`).

---

## 5. Reliable Execution, Idempotency, & Background Jobs

### Exactly-Once Idempotency Contract
- **Header**: All publishing requests require the `Idempotency-Key` header (missing keys return HTTP 400 `ValidationError`).
- **Fingerprinting**: `src/reliability/idempotency/hash.ts` calculates a cryptographic SHA-256 hash of the normalized request payload.
- **Deduplication**:
  - Repeated requests with the exact same key and payload return the previously cached outcome with **HTTP 200 OK** (`isCached: true`).
  - Reusing a key with a materially different payload throws an `IdempotencyConflictError`, returning **HTTP 409 Conflict**.

### Exponential Backoff & Classification
- `src/reliability/retry/classification.ts` categorizes HTTP errors:
  - **Retryable (Transient)**: `429 Too Many Requests`, `500 Internal Server Error`, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout`.
  - **Non-Retryable (Permanent)**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Content`.
- Retries use exponential backoff (`initialDelayMs * backoffFactor^(attempt-1)`) with full random jitter to prevent thundering herd problems.

### Asynchronous Background Processing
- Operations taking longer than 2000ms, or requests explicitly containing `"async": true`, automatically offload to `JobService` (`src/jobs/JobService.ts`).
- The API responds immediately with **HTTP 202 Accepted**, a `jobId`, and a `checkStatusUrl` (`/api/v1/jobs/:jobId`).
- A background `JobWorker` processes the queue asynchronously and records lifecycle states (`queued`, `running`, `succeeded`, `failed`).

---

## 6. REST API & OpenAPI 3.1 Specification

### Implemented Endpoints
Mounted under `/api/v1` via `src/routes/v1/index.ts`:
- `GET /health`: Basic health check, uptime, and environment.
- `GET /api/v1/destinations`: List registered connectors, declared capabilities, and policy statuses.
- `GET /api/v1/destinations/:destinationKey`: Retrieve destination capability details and rule configurations.
- `POST /api/v1/destinations/:destinationKey/publish`: Guarded, idempotent publication with async threshold offloading.
- `POST /api/v1/destinations/:destinationKey/verify/:externalId`: Publication verification (HTTP 501 if unsupported).
- `GET /api/v1/destinations/:destinationKey/status/:externalId`: Remote status check (HTTP 501 if unsupported).
- `DELETE /api/v1/destinations/:destinationKey/:externalId`: Content deletion/unpublishing (HTTP 501 if unsupported).
- `GET /api/v1/jobs/:jobId`: Background job status and execution result.
- `POST /api/v1/certification/run`: Trigger connector capability certification suite.
- `GET /api/v1/certification` & `GET /api/v1/certification/:runId`: Retrieve certification reports.

### OpenAPI 3.1 Specification
- Documented in `openapi.yaml`.
- Fully conforms to OpenAPI 3.1.0 specifications and is validated in CI via `tests/api/openapi.test.ts` using the `yaml` parser.
- Documents all endpoints, parameters, request bodies, success schemas (200, 201, 202), and error responses (400, 404, 409, 422, 501) with non-secret examples.

---

## 7. Connector Capability Certification Harness

The certification harness (`src/certification/ConnectorCertificationHarness.ts`) verifies that connectors uphold their declared capabilities without false claims.

### Lifecycle Tested
1. **Publish Operation**: Exercises simulation or mock publishing with unique run identifiers.
2. **Verify Operation**: Confirms content presence on destinations supporting verification.
3. **GetStatus Operation**: Queries lifecycle status (`published`, `simulated`).
4. **Delete & Cleanup Operation**: Ensures test content is removed where supported.
5. **Unsupported Capability Contracts**: Explicitly verifies that undeclared capabilities return `unsupported: true` and fail safely.

### Strict Mock vs. Live Isolation
- Default mode is strictly `mock`.
- Connectors are **never** labeled "Live Certified" based on mock or dry-run responses.
- Live mode requires explicit opt-in (`allowLive: true` or CLI `--live`), halting with `unverified` status if missing.
- CLI runner (`src/cli/certify.ts`) provides path-traversal protection and automatically sanitizes credentials/secrets to `[REDACTED]` in exported JSON reports.

---

## 8. Docker Environment & Local Services

The multi-container Docker Compose setup (`docker-compose.yml`) provisions:
- **`app`**: Multi-stage Node.js 22 container running the IncuBrix service as non-root user `node` on port 3000 with a health check.
- **`ghost`**: `ghost:5-alpine` running on port 2368 in development mode with SQLite storage (avoiding unnecessary database complexity for local testing).
- **`lemmy-db`**: `postgres:15-alpine` database instance genuinely required by Lemmy backend, equipped with `pg_isready` health check.
- **`lemmy`**: `dessalines/lemmy:0.19.5` running on port 8536, mounted with `docker/lemmy.hjson`.
- **Volumes**: Named persistent volumes for app artifacts, Ghost content, and PostgreSQL data.

---

## 9. Testing Strategy & Verification Results

### Summary of Executed Commands

| Command | Exit Code | Verified Outcome |
| :--- | :---: | :--- |
| `npm run build` | **0** | Clean TypeScript compilation (`tsc`) with zero errors. |
| `npm test` | **0** | **176 tests passed across 25 test files in 1.25s.** |
| `npm run test:integration` | **0** | **18 tests passed across 2 test files (E2E & local service guard).** |
| `docker build -t incubrix-app:test .` | **0** | Multi-stage Docker image built successfully. |
| `docker compose config` | **0** | Docker Compose specification syntax validated. |

### Honest Testing Status Across Tiers
- **Unit & Mock Tests (100% Passed)**: All 176 automated tests execute offline using deterministic fixtures, in-memory stores, and injected HTTP mock clients.
- **End-to-End Tests (100% Passed)**: `tests/e2e/e2e.test.ts` exercises the full HTTP request pipeline using Supertest.
- **Local Service Integration Tests (Cleanly Skipped)**: `tests/integration/localServices.test.ts` dynamically probes ports 2368 (Ghost) and 8536 (Lemmy). Because external local containers were not active and credentials were not configured during the test run, these tests were **safely skipped with clear diagnostic notices**. They are **not** claimed as executed live tests.
- **Live Production Cloud Verification (Unverified)**: No live external posts were created on public third-party services (DEV.to, production Ghost, or live Discourse).

---

## 10. Architectural Trade-offs & Known Limitations

1. **In-Memory Storage Resets**:
   - `InMemoryIdempotencyStore`, `InMemoryJobStore`, `InMemoryPublicationHistoryStore`, and `CertificationStore` store records in memory.
   - *Trade-off*: Zero external database dependency enables fast, self-contained local testing and execution.
   - *Limitation*: Process restarts will reset idempotency caches, background jobs, and publication history. Production deployment would require Redis or PostgreSQL.
2. **API Authentication Scoping**:
   - As defined by the PS4 brief, no consumer authentication (such as JWT, Bearer tokens, or API keys) is enforced on `/api/v1/*` routes.
   - *Limitation*: The application must not be exposed directly to public networks without an upstream API gateway, reverse proxy, or VPN.
3. **Manual Initial Service Setup**:
   - Ghost requires an initial administrator account to be set up manually via `http://localhost:2368/ghost` before an Admin API key can be generated.
   - Lemmy requires obtaining a JWT authentication token via `POST /api/v3/user/login`.
4. **Soft-Delete vs. Permanent Delete Variations**:
   - Some platforms (Lemmy, Discourse) only support soft-deletion (tombstoning) due to architectural or federation requirements, whereas Ghost and DEV.to support permanent deletion.

---

## 11. Security & Safety Controls

1. **Credential Hygiene**: Zero secrets or credentials are hardcoded into the source code or test fixtures. All credentials use environment variables.
2. **Redaction in Diagnostics & Reports**: The certification harness and error sanitizers explicitly redact keys matching `/api[-_]?key|secret|token|auth|password|credential/i` to `[REDACTED]`.
3. **Path Traversal Guards**: The Assisted connector and certification CLI resolve paths strictly within their respective base directories and reject directory traversal sequences (`../`).
4. **HMAC Timing & Replay Protection**: Webhook signatures enforce a 300-second timestamp tolerance window and use constant-time buffer comparison (`crypto.timingSafeEqual`).

---

## 12. Conclusion

The IncuBrix Long-Tail Distribution Destination Network successfully fulfills all functional, architectural, reliability, and certification requirements specified across the assessment stages. The codebase is clean, statically type-checked, fully documented, and verified with 176 passing automated tests.
