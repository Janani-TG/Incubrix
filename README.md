# IncuBrix Long-Tail Distribution Destination Network

A modular, production-grade Node.js and TypeScript distribution backend designed for multi-platform content syndication across long-tail technical communities and self-hosted instances.

---

## Key Capabilities

- **Modular Destination Connectors**: Extensible connector architecture with explicit capabilities (`canPublish`, `canVerify`, `canGetStatus`, `canDelete`, `supportsSimulation`). Supported destinations include **DEV.to**, **Ghost CMS**, **Discourse**, **Lemmy**, **HMAC Webhooks**, **Assisted Manual Packaging**, and an in-memory **Deterministic Mock Destination**.
- **Posting-Rules Policy Engine**: Destination-aware policy enforcement covering publishing frequency limits, self-promotion restrictions, link restrictions, and AI disclosure requirements.
- **Reliable Execution & Idempotency**: Guaranteed exactly-once execution semantics with client-supplied `Idempotency-Key` headers, payload fingerprinting, and exponential backoff retry policies.
- **Asynchronous Background Processing**: Automatic offloading of long-running operations (>2s threshold) or explicitly requested asynchronous workflows (`async: true`) into trackable background jobs (HTTP 202).
- **OpenAPI 3.1 Specification**: Comprehensive, validated OpenAPI 3.1 document (`openapi.yaml`) covering all routes, request/response models, headers, and status codes.
- **Connector Certification Harness**: Repeatable capability verification suite with strict mock-vs-live isolation, safe test content cleanup, path-traversal protection, and automated credential redaction.

---

## Architecture Overview

```
                      Client Request
                            │
               [Idempotency-Key Header]
                            ▼
               ┌─────────────────────────┐
               │    REST API (/api/v1)   │
               └────────────┬────────────┘
                            │
              ┌─────────────┴─────────────┐
              │  ReliablePublishService   │
              │   (Idempotency & Retry)   │
              └─────────────┬─────────────┘
                            │
              ┌─────────────┴─────────────┐
              │   GuardedPublishService   │
              │   (Posting Rules Engine)  │
              └─────────────┬─────────────┘
                            │ (allowed)
              ┌─────────────┴─────────────┐
              │    Connector Registry     │
              └─────────────┬─────────────┘
                            │
     ┌──────────┬───────────┼───────────┬──────────┬──────────┐
     ▼          ▼           ▼           ▼          ▼          ▼
  DEV.to      Ghost     Discourse     Lemmy     Webhook   Assisted
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

Clone the repository and install dependencies:
```bash
npm install
```

### Environment Configuration

Copy the sample environment file:
```bash
cp .env.example .env
```

Key environment configuration variables:
```dotenv
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
API_PREFIX=/api/v1

# Optional destination credentials for live integration
DEVTO_API_KEY=
GHOST_ADMIN_API_KEY=
GHOST_API_URL=http://localhost:2368
DISCOURSE_API_KEY=
DISCOURSE_API_USERNAME=system
DISCOURSE_BASE_URL=http://localhost:4200
LEMMY_AUTH_TOKEN=
LEMMY_INSTANCE_URL=http://localhost:8536
WEBHOOK_URL=
WEBHOOK_SECRET=
```

---

## Build and Run

### Development Mode
Runs the application with hot-reloading via `tsx`:
```bash
npm run dev
```

### Production Build & Execution
Compile TypeScript to JavaScript and run:
```bash
npm run build
npm start
```

### Automated Tests
Run Vitest across all 23 test suites (unit, integration, reliability, API, and OpenAPI validation):
```bash
npm test
```

---

## Connector Certification Harness

The certification harness validates that each connector correctly implements its declared capabilities and explicitly handles unsupported capabilities.

### Run via CLI

Run all connectors in default offline/mock mode:
```bash
npm run certify
```

Certify a single connector:
```bash
npm run certify -- --destination devto
```

Run in Live Integration Mode (requires explicit opt-in flag):
```bash
npm run certify -- --destination devto --live
```

Specify output directory for JSON reports:
```bash
npm run certify -- --out artifacts/certification
```

> [!NOTE]
> For details on test isolation, cleanup mechanisms, and diagnostic reporting, consult [docs/certification-guide.md](file:///D:/Projects/Incubrix/docs/certification-guide.md).

---

## API Reference & Examples

All versioned REST endpoints are mounted under `/api/v1`.

### 1. Health Check
```bash
curl -X GET http://localhost:3000/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-10-19T12:00:00.000Z",
  "uptime": 45.2,
  "environment": "development"
}
```

### 2. List Registered Destinations
```bash
curl -X GET http://localhost:3000/api/v1/destinations
```

### 3. Get Destination Details
```bash
curl -X GET http://localhost:3000/api/v1/destinations/devto
```

### 4. Publish Content (Guarded & Idempotent)
The `Idempotency-Key` header is mandatory for all publication requests.

```bash
curl -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: release-announcement-v1" \
  -d '{
    "content": {
      "title": "Announcing Distribution Network v1.0",
      "body": "Detailed release notes and distribution guide.",
      "summary": "Release announcement",
      "tags": ["release", "announcement"]
    },
    "simulate": true
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "decision": "allowed",
  "destinationKey": "mock",
  "externalId": "sim-mock-1",
  "externalUrl": "https://mock.incubrix.local/simulated/sim-mock-1",
  "status": "simulated",
  "isSimulated": true,
  "isCached": false,
  "timestamp": "2026-10-19T12:00:00.000Z"
}
```

### 5. Asynchronous Publishing (Background Job)
Supply `"async": true` in the request body to execute in the background:
```bash
curl -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: release-announcement-async-001" \
  -d '{
    "content": {
      "title": "Long-running Content Ingestion",
      "body": "Extensive article body..."
    },
    "async": true
  }'
```

**Response (202 Accepted):**
```json
{
  "status": "queued",
  "jobId": "job-1792412559595-1-a1b2c3d4",
  "destinationKey": "mock",
  "message": "Publishing request queued for background execution.",
  "checkStatusUrl": "/api/v1/jobs/job-1792412559595-1-a1b2c3d4"
}
```

### 6. Check Job Status
```bash
curl -X GET http://localhost:3000/api/v1/jobs/job-1792412559595-1-a1b2c3d4
```

### 7. Verify Publication
```bash
curl -X POST http://localhost:3000/api/v1/destinations/mock/verify/sim-mock-1
```

### 8. Query Remote Publication Status
```bash
curl -X GET http://localhost:3000/api/v1/destinations/mock/status/sim-mock-1
```

### 9. Delete Publication
```bash
curl -X DELETE http://localhost:3000/api/v1/destinations/mock/sim-mock-1?simulate=true
```

### 10. Run Connector Certification via API
```bash
curl -X POST http://localhost:3000/api/v1/certification/run \
  -H "Content-Type: application/json" \
  -d '{
    "destinationKey": "mock",
    "mode": "mock"
  }'
```

---

## OpenAPI 3.1 Specification

The API contract is formally documented in `openapi.yaml` conforming to the OpenAPI 3.1.0 specification.
To validate the specification, run:
```bash
npm test tests/api/openapi.test.ts
```

---

## Security and Authentication Limitations

> [!IMPORTANT]
> **API Authentication Limitation**: As defined by the PS4 assessment brief, no user/service authentication layer (such as OAuth2, JWT, or API keys) has been implemented on `/api/v1/*` routes.
>
> **Operational Guidance**:
> - Do not expose this service directly to the public Internet without an upstream API gateway, reverse proxy, or VPN.
> - Outgoing platform credentials must be provided via environment variables only and are redacted from all diagnostic logs and certification reports.
