# IncuBrix Connector Certification Guide

This guide describes the connector capability certification harness, distinguishing offline/mock verification from live integration testing, safety guards, automated cleanup, and reporting formats.

---

## 1. Objective and Purpose

The **Connector Certification Harness** verifies that destination connectors faithfully uphold their declared capabilities without false claims or silent failures.

Every destination connector declares capabilities via `ConnectorCapabilities`:
- `canPublish`: Destination accepts new content publication.
- `canVerify`: Destination supports verifying publication presence and URL resolution.
- `canGetStatus`: Destination exposes remote publication lifecycle status.
- `canDelete`: Destination supports remote content deletion/unpublishing.
- `supportsSimulation`: Destination supports non-mutating dry-run simulations.

The certification suite tests each declared capability using isolated, uniquely identifiable content. Crucially, the harness also tests undeclared capabilities to ensure the connector returns an explicit unsupported result (`unsupported: true`) rather than fabricating success.

---

## 2. Mock Mode vs. Live Integration Mode

| Feature | Mock / Offline Mode (Default) | Live Integration Mode (Opt-In Only) |
| :--- | :--- | :--- |
| **Execution Flag** | Default mode (no extra flags needed) | Requires `--live` CLI flag or `{ mode: 'live', allowLive: true }` API payload |
| **External Calls** | Zero real external HTTP requests; uses simulated responses | Makes authenticated requests to destination API/instance |
| **Credentials** | Dummy credentials allowed / not required | Valid credentials required via `.env` or configuration |
| **Certification Status** | `environment: 'mock'`, `isCertified: true/false`, `liveOptIn: false` | `environment: 'live'`, `isCertified: true/false`, `liveOptIn: true` |
| **Safety Guarantee** | **Never labeled as live certified** | Requires intentional opt-in to avoid accidental public posting |

> [!WARNING]
> A connector is **NEVER** marked as "Live Certified" based on mocked or simulated responses. If `mode: 'live'` is requested without explicit `allowLive: true`, the test execution immediately halts with an `unverified` status.

---

## 3. Certification Check Sequence

For each connector, the harness executes an isolated capability lifecycle:

1. **Publish Operation**:
   - Publishes isolated test content with a unique run ID and test identifier.
   - In mock mode: exercises `simulate: true` (or in-memory mock storage).
   - In live mode: publishes real test content to the configured sandbox or target instance.
   - Evaluates: `success: true`, valid `externalId`, and valid `status`.
2. **Verify Operation**:
   - If `canVerify: true`: Queries destination using the `externalId` returned from the publish step. Confirms `verified: true`.
   - If `canVerify: false`: Confirms the connector returns `unsupported: true` and `success: false`.
3. **GetStatus Operation**:
   - If `canGetStatus: true`: Queries remote lifecycle status for the `externalId`. Confirms `success: true` and valid status (`published`, `simulated`, etc.).
   - If `canGetStatus: false`: Confirms the connector returns `unsupported: true` and `success: false`.
4. **Delete & Cleanup Operation**:
   - If `canDelete: true`: Submits deletion request for the `externalId` to clean up the test content. Confirms `deleted: true`.
   - If `canDelete: false`: Confirms the connector returns `unsupported: true` and `success: false`.
5. **Outcome Aggregation**:
   - Counts `passed`, `failed`, `skipped`, and `unverified`.
   - Connector is marked `isCertified: true` if and only if all applicable checks passed or were legitimately skipped.

---

## 4. Test Isolation and Content Cleanup

- **Unique Identifiers**: Every certification run generates a unique `runId` (e.g. `cert-1792412559595-a1b2c3d4`) and prepends `[Certification <timestamp>]` to post titles.
- **Immediate Cleanup**: Deletion is automatically executed at the end of the test sequence for platforms that support remote deletion (e.g. DEV.to, Ghost, Discourse, Lemmy, and Mock connectors).
- **Read-Only / Append-Only Destinations**: For destinations that do not support deletion (e.g. Webhook endpoints or Assisted manual packs), the deletion step is recorded as `Unsupported Delete Contract: PASSED`, proving the connector does not claim deletion capability.

---

## 5. CLI Certification Runner

The standalone CLI runner (`src/cli/certify.ts`) enables batch or single-connector certification from the terminal or CI/CD pipelines.

### Usage

Run all registered connectors in default mock mode:
```bash
npm run certify
```

Certify a specific connector:
```bash
npm run certify -- --destination devto
npm run certify -- -d mock
```

Specify a custom report output directory:
```bash
npm run certify -- --out artifacts/custom-reports
```

Run in Live Integration Mode (explicit opt-in):
```bash
npm run certify -- --destination devto --live
```

### Path Traversal Protection
The CLI strictly validates that `--out` points within the workspace root. Any attempt to supply an output path outside the workspace (e.g. `../../etc` or `D:\Projects\outside`) is rejected with an error and exit code `1`.

### Exit Codes
- `0`: All tested connectors passed their required capability checks.
- `1`: One or more connector capability checks failed, or invalid flags / unsafe paths were provided.

---

## 6. Machine-Readable JSON Output and Credential Redaction

Each run outputs a timestamped JSON file (e.g. `artifacts/certification/certification-report-1792412559595.json`).

### Safe Redaction Guarantee
Before serializing the report to disk, all object keys matching API keys, tokens, auth headers, passwords, and secrets are sanitized to `[REDACTED]`. The destination identifier (`destinationKey`) is preserved.

Example JSON output structure:
```json
[
  {
    "runId": "cert-1792412803460-29c36219",
    "destinationKey": "mock",
    "connectorName": "Deterministic Mock Destination",
    "environment": "mock",
    "startedAt": "2026-10-19T12:26:43.460Z",
    "completedAt": "2026-10-19T12:26:43.462Z",
    "totalDurationMs": 2,
    "summary": {
      "passed": 4,
      "failed": 0,
      "skipped": 0,
      "unverified": 0
    },
    "checks": [
      {
        "name": "Publish Operation",
        "status": "passed",
        "durationMs": 0,
        "message": "Publish succeeded with externalId: sim-mock-1",
        "details": {
          "isSimulated": true,
          "status": "simulated"
        }
      },
      {
        "name": "Verify Operation",
        "status": "passed",
        "durationMs": 1,
        "message": "Verification confirmed for externalId: sim-mock-1"
      },
      {
        "name": "GetStatus Operation",
        "status": "passed",
        "durationMs": 0,
        "message": "Status query returned: simulated"
      },
      {
        "name": "Delete & Cleanup Operation",
        "status": "passed",
        "durationMs": 0,
        "message": "Test content cleaned up successfully for externalId: sim-mock-1"
      }
    ],
    "isCertified": true,
    "liveOptIn": false
  }
]
```

---

## 7. REST API Certification Endpoints

Certification can also be triggered and inspected programmatically over HTTP:

- `POST /api/v1/certification/run`: Runs capability certification for one or all destinations.
  - Body: `{ "destinationKey": "devto", "mode": "mock" }`
  - To opt into live mode: `{ "destinationKey": "devto", "mode": "live", "allowLive": true }`
- `GET /api/v1/certification`: Returns history of stored certification reports.
- `GET /api/v1/certification/:runId`: Retrieves a specific certification report by `runId`.
