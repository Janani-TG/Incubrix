# IncuBrix Long-Tail Distribution Network: Video Demo Script

**Target Duration**: 6 to 8 minutes (Strict maximum: 8 minutes)  
**Format**: Unedited continuous screen recording with voiceover  
**Safety Protocol**: Exercises offline simulation and mock connectors only. Never publishes real content to public communities.

---

## Pre-Recording Checklist (Candidate Preparation)

1. Open two terminal windows side-by-side in `D:\Projects\Incubrix`:
   - **Terminal 1**: Application server runner.
   - **Terminal 2**: Commands and curl execution.
2. Clean working tree verified (`git status`).
3. Ensure port 3000 is free (`netstat -ano | findstr :3000`).
4. Ensure `.env` is initialized from `.env.example`.
5. Set terminal font size to be clearly readable (e.g. 14pt–16pt).

---

## Scene 1: Introduction & Architecture Overview (~45 seconds)

### Visual
Display the repository root, `README.md`, and `openapi.yaml` in your editor or terminal.

### Speaking Points
> "Hello, this is the demonstration for the IncuBrix Software Engineer PS4 assessment: Long-Tail Distribution Destination Network.
> 
> The application is a modular Node.js and TypeScript distribution backend designed for multi-platform content syndication across heterogeneous platforms with asymmetric capabilities—including DEV.to, Ghost CMS, Discourse, Lemmy, HMAC Webhooks, and Assisted Manual Packaging.
>
> All publishing requests pass through a policy guard service enforcing destination posting rules, and a reliable execution layer providing exactly-once idempotency, retry handling, and automatic asynchronous background job offloading."

---

## Scene 2: Build & Automated Test Suite (~1 minute)

### Action (Terminal 2)
```bash
npm run build
```
*Expected*: `tsc` exits cleanly with code 0.

### Action (Terminal 2)
```bash
npm test
```
*Expected*: Vitest runs and reports:
`Test Files  25 passed (25)`  
`Tests       176 passed (176)`

### Speaking Points
> "First, we verify static type safety with `npm run build`, which compiles TypeScript with zero errors.
>
> Next, we execute the automated test suite with `npm test`. All 176 automated tests across 25 test suites pass deterministically in offline mode without making external network calls.
>
> Notice also that local service integration tests for Ghost and Lemmy in `tests/integration/localServices.test.ts` dynamically probe container readiness and safely skip when external containers are unconfigured, ensuring mock tests are never falsely labeled as live integration tests."

---

## Scene 3: Start the Application Server (~30 seconds)

### Action (Terminal 1)
```bash
npm start
```
*Expected output*:
Server starts listening on port 3000 (e.g. `Server running on http://0.0.0.0:3000`).

### Speaking Points
> "Now let's launch the compiled production server on port 3000."

---

## Scene 4: Core API & Architecture Demonstration (~3 minutes 30 seconds)

*(All actions executed in Terminal 2)*

### 1. Health Check
```bash
curl -s http://localhost:3000/health
```
*Expected Result*:
```json
{"status":"ok","timestamp":"...","uptime":...,"environment":"production"}
```
> "The `/health` endpoint confirms the service is operational."

---

### 2. Destination Discovery & Capability Matrix
```bash
curl -s http://localhost:3000/api/v1/destinations
```
*Expected Result*:
JSON array listing all 7 registered connectors (`mock`, `devto`, `ghost`, `discourse`, `lemmy`, `webhook`, `assisted`) and their declared capabilities.
> "The `/destinations` endpoint exposes registered connectors and their declared capabilities. Note that Webhook explicitly declares `canVerify: false` and `canDelete: false`."

---

### 3. Idempotency Validation Guard
```bash
curl -s -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -d '{"content":{"title":"Test","body":"Test body"}}'
```
*Expected Result*:
```json
{"error":"ValidationError","message":"Header 'Idempotency-Key' is required for publication requests.","statusCode":400}
```
> "Publishing requests strictly require an `Idempotency-Key` header, returning HTTP 400 if missing."

---

### 4. Successful Mock Publication
```bash
curl -s -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-video-key-001" \
  -d '{
    "content": {
      "title": "Scalable Long-Tail Distribution Architecture",
      "body": "In-depth guide on modular connectors.",
      "summary": "Technical guide",
      "tags": ["architecture", "typescript"]
    },
    "simulate": true
  }'
```
*Expected Result (HTTP 201 Created)*:
```json
{
  "success": true,
  "decision": "allowed",
  "destinationKey": "mock",
  "externalId": "sim-mock-1",
  "status": "simulated",
  "isSimulated": true,
  "isCached": false
}
```
> "With a valid key, the content is evaluated by posting rules, approved, and published with HTTP 201 Created."

---

### 5. Exactly-Once Idempotency Replay
Execute the exact same curl command again:
```bash
curl -s -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-video-key-001" \
  -d '{
    "content": {
      "title": "Scalable Long-Tail Distribution Architecture",
      "body": "In-depth guide on modular connectors.",
      "summary": "Technical guide",
      "tags": ["architecture", "typescript"]
    },
    "simulate": true
  }'
```
*Expected Result (HTTP 200 OK)*:
Returns the cached result with `"isCached": true` and matching `externalId`.
> "When the exact same request is submitted with the same idempotency key, the server returns the cached response with HTTP 200 OK without re-executing the connector."

---

### 6. Idempotency Conflict Detection
Execute with the same key (`demo-video-key-001`) but change the title:
```bash
curl -s -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-video-key-001" \
  -d '{
    "content": {
      "title": "Conflicting Different Title",
      "body": "In-depth guide on modular connectors."
    },
    "simulate": true
  }'
```
*Expected Result (HTTP 409 Conflict)*:
```json
{
  "error": "IdempotencyConflict",
  "message": "Idempotency key 'demo-video-key-001' was previously used with a materially different request payload.",
  "statusCode": 409
}
```
> "Reusing an idempotency key with a materially different payload is immediately rejected with HTTP 409 Conflict."

---

### 7. Asynchronous Background Job Transition
```bash
curl -s -X POST http://localhost:3000/api/v1/destinations/mock/publish \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-video-async-001" \
  -d '{
    "content": {
      "title": "Large Ingestion Job",
      "body": "Large content payload."
    },
    "async": true
  }'
```
*Expected Result (HTTP 202 Accepted)*:
```json
{
  "status": "queued",
  "jobId": "job-...",
  "destinationKey": "mock",
  "message": "Publishing request queued for background execution.",
  "checkStatusUrl": "/api/v1/jobs/job-..."
}
```
> "Operations requesting asynchronous processing (or operations exceeding the 2-second processing threshold) return HTTP 202 Accepted with a trackable job handle."

Query job status:
*(Replace `JOB_ID` with the returned jobId)*
```bash
curl -s http://localhost:3000/api/v1/jobs/JOB_ID
```
*Expected Result*: Returns job record with status (`queued`, `running`, or `succeeded`).

---

### 8. Explicit Unsupported Capability Handling
```bash
curl -s -X POST http://localhost:3000/api/v1/destinations/webhook/verify/test-id-123
```
*Expected Result (HTTP 501)*:
```json
{
  "error": "UnsupportedCapability",
  "message": "Webhook destinations are push-only and do not support active remote verification.",
  "statusCode": 501,
  "unsupported": true
}
```
> "Rather than fabricating success, unsupported operations explicitly return HTTP 501 UnsupportedCapability."

---

## Scene 5: Connector Capability Certification Runner (~1 minute)

### Action (Terminal 2)
```bash
npm run certify -- --destination mock
```

*Expected output*:
```text
====================================================
IncuBrix Connector Certification Suite
Environment: MOCK / OFFLINE
Target Destination(s): mock
====================================================

--> Running certification for: [mock] Deterministic Mock Destination...
   [✓] Publish Operation: PASSED (0ms) - Publish succeeded with externalId: sim-mock-1
   [✓] Verify Operation: PASSED (0ms) - Verification confirmed for externalId: sim-mock-1
   [✓] GetStatus Operation: PASSED (0ms) - Status query returned: simulated
   [✓] Delete & Cleanup Operation: PASSED (0ms) - Test content cleaned up successfully for externalId: sim-mock-1
   Outcome: CERTIFIED

====================================================
Summary: 4 Passed | 0 Failed | 0 Skipped | 0 Unverified
====================================================
JSON report saved to: .../certification-report-...json
```

### Speaking Points
> "The CLI certification harness tests each connector through an isolated lifecycle: publish, verify, status check, and automated content cleanup.
>
> In accordance with safety rules, the harness runs in mock mode by default and redacts all sensitive credential keys from the output JSON report. Live certification requires an explicit opt-in flag."

---

## Scene 6: Docker Configuration & Conclusion (~45 seconds)

### Action (Terminal 2)
```bash
docker compose config
```

### Speaking Points
> "For containerized local deployment, `docker-compose.yml` orchestrates our multi-stage Node.js application alongside local Ghost CMS, Lemmy federated aggregator, and PostgreSQL instances, equipped with health checks.
>
> In conclusion, the system provides a robust foundation for multi-platform distribution with verified policy enforcement, reliability, and capability certification. Thank you."

---

## Post-Recording Verification Checklist

- [ ] Video length is under 8 minutes.
- [ ] No personal secrets, real API keys, or live passwords appeared on screen.
- [ ] No real content was published to live public accounts.
- [ ] Voice audio is clear and synchronized with terminal execution.
- [ ] Server process stopped in Terminal 1 (`Ctrl + C`).
