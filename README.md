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
- **Docker Compose Local Testing**: Pre-configured multi-container environment supporting the core application, Ghost CMS, Lemmy federated aggregator, and PostgreSQL with automated health checks.

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
- Docker & Docker Compose (optional, for local container testing)

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

# Destination Connector Configuration
DEVTO_API_KEY=
DEVTO_BASE_URL=https://dev.to/api
GHOST_ADMIN_API_KEY=
GHOST_API_URL=http://localhost:2368
DISCOURSE_API_KEY=
DISCOURSE_API_USERNAME=system
DISCOURSE_BASE_URL=http://localhost:4200
LEMMY_AUTH_TOKEN=
LEMMY_INSTANCE_URL=http://localhost:8536
LEMMY_COMMUNITY_ID=1
WEBHOOK_URL=
WEBHOOK_SECRET=
ASSISTED_OUTPUT_DIR=./artifacts/assisted_packs
CERTIFICATION_OUTPUT_DIR=./artifacts/certification
```

---

---

## Web Dashboard & Simulator

IncuBrix includes a polished, responsive web dashboard built with React, Vite, and TypeScript. The dashboard connects to the Express REST API at `http://localhost:3000` and provides complete visibility into connector capabilities, posting rules evaluation, idempotent replay verification, and certification reports.

> **Safety Notice:** All publishing actions initiated through the Web Dashboard strictly default to dry-run simulation mode (`simulate: true`). Real external platforms are never targeted from the UI.

### Key Dashboard Pages

1. **Overview**: Real-time service health (`/health`), uptime, environment details, registered destination counts, and activity highlights.
2. **Destinations**: Full connector capability matrix (`canPublish`, `canVerify`, `canGetStatus`, `canDelete`, `supportsSimulation`) and posting rules policy inspector (`/api/v1/destinations/:destinationKey`).
3. **Publish Simulator**: Safe content submission form supporting destination selection, required `Idempotency-Key` generation/replay, markdown body editor, and automatic polling for background asynchronous jobs (HTTP 202).
4. **Results & Audit Logs**: Detailed breakdown of publish decisions (`allowed` vs `blocked`), simulated/external IDs, idempotency replay statuses (`isCached: true`), rule violation alerts, and post-publish lifecycle verification actions (`verify`, `status`, `delete`).
5. **Certification**: Visual presentation of actual connector certification reports (`GET /api/v1/certification`), interactive in-memory mock certification suite runner (`POST /api/v1/certification/run`), and terminal CLI instructions (`npm run certify`).

---

## Build and Run

### Concurrent Development (Recommended)

To start both the backend API (`http://localhost:3000`) and the web dashboard (`http://localhost:5173`) concurrently in a single terminal:

```bash
npm run dev:all
```

### Running Services Individually

#### 1. Backend Service
```bash
# Install backend dependencies (if not already installed)
npm install

# Start Express backend with hot-reload on http://localhost:3000
npm run dev
```

#### 2. Frontend Web Dashboard
```bash
# Install frontend dependencies (if not already installed)
npm run frontend:install
# (or: cd frontend && npm install)

# Start Vite dashboard dev server on http://localhost:5173
npm run frontend:dev
# (or: cd frontend && npm run dev)
```

### Production Build & Execution

```bash
# Compile backend TypeScript
npm run build

# Build frontend production bundle
npm run frontend:build

# Start production backend server
npm start
```

### Linting & Code Quality

```bash
# Lint frontend code with Oxlint
npm run frontend:lint
```

### Automated Testing

```bash
# Run all unit, reliability, connector, and API test suites (offline / mocks)
npm test

# Run End-to-End API and local service integration tests
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

---

## Docker Setup & Local Services

The repository includes a production multi-stage `Dockerfile` and a `docker-compose.yml` for local service integration testing.

### Services Defined

| Service | Image / Build | Port | Purpose | Health Check |
| :--- | :--- | :--- | :--- | :--- |
| `app` | Multi-stage Node.js 22 | `3000:3000` | IncuBrix Distribution API | `wget -qO- http://localhost:3000/health` |
| `ghost` | `ghost:5-alpine` | `2368:2368` | Local Ghost CMS Instance (SQLite dev mode) | `wget -qO- http://localhost:2368/` |
| `lemmy-db` | `postgres:15-alpine` | Internal | PostgreSQL 15 for Lemmy | `pg_isready -U lemmy -d lemmy` |
| `lemmy` | `dessalines/lemmy:0.19.5` | `8536:8536` | Local Lemmy Link Aggregator | `wget -qO- http://localhost:8536/api/v3/site` |

### Docker Commands

#### 1. Start Services
```bash
docker compose up -d
```

#### 2. Check Readiness and Health Checks
```bash
docker compose ps
```

#### 3. Inspect Container Logs
```bash
# View app logs
docker compose logs -f app

# View Ghost CMS logs
docker compose logs -f ghost

# View Lemmy logs
docker compose logs -f lemmy
```

#### 4. Stop Services
```bash
# Stop containers (preserves volume data)
docker compose down

# Stop containers and purge persistent data volumes
docker compose down -v
```

### Local Service Setup Walkthrough

#### Configuring Local Ghost CMS
1. Run `docker compose up -d ghost`.
2. Open `http://localhost:2368/ghost` in your browser.
3. Complete the initial Ghost admin setup wizard.
4. Navigate to **Settings > Integrations > Add Custom Integration**.
5. Copy the generated **Admin API Key** into `GHOST_ADMIN_API_KEY` in `.env`.

#### Configuring Local Lemmy
1. Run `docker compose up -d lemmy lemmy-db`.
2. The instance is seeded with credentials from `docker/lemmy.hjson` (`admin` / `password123`).
3. Fetch your JWT authentication token via:
   ```bash
   curl -X POST http://localhost:8536/api/v3/user/login \
     -H "Content-Type: application/json" \
     -d '{"username_or_email":"admin","password":"password123"}'
   ```
4. Set `LEMMY_AUTH_TOKEN` in `.env` with the returned `jwt` value.

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

## Known Limitations & Security Considerations

1. **API Authentication Limitation**: As scoped by the assessment brief, no consumer authentication mechanism (such as JWT, Bearer token, or OAuth2) is enforced on `/api/v1/*` routes.
   - **Operational Recommendation**: Never expose this service directly to public networks without an upstream API gateway, reverse proxy, or VPN.
2. **In-Memory Storage Backends**: Idempotency records, background job queues, publication history records, and certification reports are stored in memory (`InMemoryIdempotencyStore`, `InMemoryJobStore`, `InMemoryPublicationHistoryStore`, `CertificationStore`). Restarting the service will reset these stores. Production deployment would require external datastores such as Redis or PostgreSQL.
3. **External Platform Live Tests**: Connectors targeting third-party cloud services (DEV.to, live Discourse, production Lemmy instances) require valid credentials and are not run automatically in CI. Automated test suites strictly use deterministic mocks and injected HTTP clients.
4. **Local Service Manual Setup**:
   - Ghost requires an initial administrator account to be created via the web browser at `http://localhost:2368/ghost` before an Admin API key can be generated.
   - Lemmy requires an active user token obtained via `POST /api/v3/user/login`.
