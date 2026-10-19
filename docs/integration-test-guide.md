# Integration-Test Guide & Platform Connectors

This document provides setup instructions, environment configurations, and official API documentation sources for running integration tests against the destination connectors.

> [!IMPORTANT]
> **Safety Notice**: Automated test suites (`npm test`) run entirely offline using deterministic mocks and injected HTTP clients. Never point integration tests to public production accounts or live community subforums. Only local container instances or isolated staging environments should be used.

---

## 1. Supported Platform Connectors & Official API References

| Connector | Destination Key | Authentication | Primary API References | Deletion Semantics |
| :--- | :--- | :--- | :--- | :--- |
| **DEV.to** | `devto` | `api-key: <token>` | [Forem / Dev.to API v0 Docs](https://developers.forem.com/api/v0) | Permanent deletion from index |
| **Ghost** | `ghost` | JWT (`Authorization: Ghost <token>`) | [Ghost Admin API Reference](https://ghost.org/docs/admin-api/) | Permanent database deletion (HTTP 204) |
| **Discourse** | `discourse` | `Api-Key` & `Api-Username` | [Discourse Official API Docs](https://docs.discourse.org/) | Soft-deletion (tombstone for staff audit) |
| **Lemmy** | `lemmy` | JWT (`auth: <token>`) | [Lemmy HTTP API v3](https://join-lemmy.org/api/index.html) | Soft-deletion (ActivityPub tombstone) |
| **HMAC Webhook** | `webhook` | HMAC-SHA256 (`t=...,v1=...`) | [Standard Webhooks Specification](https://standardwebhooks.com/) | Unsupported (returns HTTP 501) |
| **Assisted Packager**| `assisted` | Filesystem permissions | Local filesystem packager | Permanent pack directory deletion |

---

## 2. Docker Compose Environment Setup

The repository provides a `docker-compose.yml` that provisions:
1. `app`: The IncuBrix distribution backend service (port 3000).
2. `ghost`: Ghost CMS instance in development mode with SQLite storage (port 2368).
3. `lemmy-db`: PostgreSQL 15 database instance for Lemmy backend.
4. `lemmy`: Lemmy federated aggregator instance mounted with `docker/lemmy.hjson` (port 8536).

### Starting Services

```bash
# Start all containers in the background
docker compose up -d

# Check service status and health checks
docker compose ps

# View container logs
docker compose logs -f ghost
docker compose logs -f lemmy
```

### Readiness Checks
- **IncuBrix App**: `curl http://localhost:3000/health` (returns `{"status":"ok",...}`)
- **Ghost CMS**: `curl http://localhost:2368/` (HTTP 200)
- **Lemmy**: `curl http://localhost:8536/api/v3/site` (HTTP 200 with site info)

### Stopping Services
```bash
# Stop containers while preserving volume data
docker compose down

# Stop containers and remove persistent volumes for a fresh state
docker compose down -v
```

---

## 3. Local Service Configuration Walkthrough

### Ghost CMS Initial Setup
Ghost requires an initial administrator account to generate an Admin API key:
1. Ensure the Ghost container is running (`docker compose up -d ghost`).
2. Open `http://localhost:2368/ghost` in your browser.
3. Complete the initial blog setup wizard (create an admin username/password).
4. Navigate to **Settings > Integrations > Add Custom Integration** (name it e.g. "IncuBrix Integration").
5. Copy the generated **Admin API Key** (formatted `{24-hex-id}:{64-hex-secret}`).
6. Update `GHOST_ADMIN_API_KEY` in your `.env` file.

### Lemmy Initial Setup
1. Ensure `lemmy` and `lemmy-db` containers are running.
2. The initial instance setup is pre-seeded with admin credentials from `docker/lemmy.hjson`:
   - Admin Username: `admin`
   - Admin Password: `password123`
3. Obtain the JWT auth token via Lemmy HTTP API:
   ```bash
   curl -X POST http://localhost:8536/api/v3/user/login \
     -H "Content-Type: application/json" \
     -d '{"username_or_email":"admin","password":"password123"}'
   ```
4. Extract the `jwt` field from the JSON response and set `LEMMY_AUTH_TOKEN` in `.env`.
5. Create a test community or identify community ID 1 and set `LEMMY_COMMUNITY_ID=1`.

---

## 4. Running Integration Tests

```bash
# Run unit and offline mock test suites (always safe, zero external network calls)
npm test

# Run end-to-end API and genuine local container integration tests
npm run test:integration
```

### Dynamic Execution Guard
The test file `tests/integration/localServices.test.ts` probes local service readiness before attempting real HTTP operations:
- If `http://localhost:2368` or `http://localhost:8536` is unreachable or unconfigured, genuine network tests are **cleanly skipped** with an informative log message.
- Mocked tests are **never** reported as live integration tests.
- When local containers are active and credentials configured, genuine live tests verify publication, verification, and deletion against the local instances.

---

## 5. Security & Credential Hygiene Guidelines

1. **No Hardcoded Credentials**: Source code and test fixtures strictly use environment variables or injected mocks.
2. **Credential Redaction in Logs**: HTTP headers such as `Authorization`, `api-key`, and `Api-Key` must never be logged.
3. **Replay Protection**: The HMAC webhook implementation verifies timestamp drift against a configurable tolerance window (default 300s) and performs constant-time signature comparisons (`crypto.timingSafeEqual`).
4. **Path Traversal Protection**: The Assisted connector strictly resolves output paths against the configured base directory and rejects traversal sequences (`../`).
