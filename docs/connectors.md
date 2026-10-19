# Core Connector Architecture & Capability Verification

This document describes the core destination connector architecture for the IncuBrix Long-Tail Distribution Destination Network, detailing capability models, official API documentation alignments, deletion semantics, and testing status tiers.

---

## 1. Overview

The connector architecture provides an extensible, strongly typed abstraction layer that decouples content distribution logic from individual destination platform requirements.

```
+-------------------------------------------------------+
|                   Application Core                    |
+---------------------------+---------------------------+
                            |
                            v
+-------------------------------------------------------+
|                  Connector Registry                   |
+-----+---------+---------+---------+---------+---------+
      |         |         |         |         |         |
      v         v         v         v         v         v
   DEV.to     Ghost   Discourse   Lemmy    Webhook  Assisted
```

---

## 2. Core Interfaces & Types

### 1. `Connector` Interface (`src/connectors/types.ts`)
- `publish(request: PublishRequest): Promise<PublishResult>`: Publishes content to the destination or executes dry-run simulation.
- `verify(request: VerifyRequest): Promise<VerifyResult>`: Confirms content presence and URL resolution on remote platform.
- `getStatus(request: GetStatusRequest): Promise<GetStatusResult>`: Retrieves remote lifecycle status (`published`, `draft`, `simulated`, etc.).
- `delete(request: DeleteRequest): Promise<DeleteResult>`: Removes or unpublishes content from the platform.

### 2. Explicit Capability Matrix
Connectors explicitly declare supported operations via `ConnectorCapabilities`:
- `canPublish: boolean`
- `canVerify: boolean`
- `canGetStatus: boolean`
- `canDelete: boolean`
- `supportsSimulation: boolean`

When an unsupported operation is invoked:
- The connector returns `success: false`, `unsupported: true`, and an explanatory `unsupportedReason`.
- The API layer maps this directly to **HTTP 501 UnsupportedCapability**.
- The connector **never** returns a false success response for an unsupported capability.

---

## 3. Official API Mapping & Deletion Semantics

| Connector | Destination Key | Declared Capabilities | Official API Reference | Deletion Semantics (Permanent vs. Soft-Delete) |
| :--- | :--- | :--- | :--- | :--- |
| **DEV.to** | `devto` | Publish, Verify, GetStatus, Delete, Simulation | [Forem API v0](https://developers.forem.com/api/v0) (`DELETE /api/articles/{id}`) | **Permanent Deletion**: Article is removed from DEV.to index and unlisted. |
| **Ghost CMS** | `ghost` | Publish, Verify, GetStatus, Delete, Simulation | [Ghost Admin API v5](https://ghost.org/docs/admin-api/) (`DELETE /ghost/api/admin/posts/{id}/`) | **Permanent Deletion**: Post is completely removed from the Ghost SQLite/MySQL database (returns HTTP 204). Soft-unpublishing can alternatively be achieved via `PUT /posts/{id}/` by setting `status: draft`. |
| **Discourse** | `discourse` | Publish, Verify, GetStatus, Delete, Simulation | [Discourse API](https://docs.discourse.org/) (`DELETE /posts/{id}.json`) | **Soft-Deletion (Tombstone)**: Post is hidden from public view and marked with a tombstone. Retained for forum staff review and audit history; permanent purge requires manual admin destroy. |
| **Lemmy** | `lemmy` | Publish, Verify, GetStatus, Delete, Simulation | [Lemmy HTTP API v3](https://join-lemmy.org/api/index.html) (`POST /api/v3/post/delete`) | **Soft-Deletion (Federated Tombstone)**: Post content is replaced with tombstone and `deleted: true`. ActivityPub federation requires tombstones to maintain graph consensus across instances. |
| **HMAC Webhook** | `webhook` | Publish, Simulation | [Standard Webhooks](https://standardwebhooks.com/) | **Unsupported**: Webhooks are push-only events; remote content cannot be verified or deleted via webhook protocol. Returns HTTP 501. |
| **Assisted Packager**| `assisted`| Publish, Verify, GetStatus, Delete, Simulation | Local Filesystem Packager | **Permanent Deletion**: Removes the generated ready-to-post pack directory from the local filesystem (`fs.rmSync`). |
| **Mock** | `mock` | Publish, Verify, GetStatus, Delete, Simulation | In-Memory Deterministic Mock | **Permanent Memory Cleanup**: Item is removed from the in-memory Map. |

---

## 4. Verification & Testing Tiers

To prevent misleading claims, connector testing is categorized into four strict verification tiers:

1. **Implemented**: TypeScript connector implementation exists and adheres to domain contracts.
2. **Mock-Tested**: Automated offline testing in Vitest using deterministic mocks, simulated responses, or injected HTTP clients.
3. **Locally Integration-Tested**: Tested against a genuine local container instance running via Docker Compose (Ghost, Lemmy, PostgreSQL).
4. **Live-Verified**: Tested against a real public production account with active credentials.

### Current Verification Status

| Connector | Implemented | Mock-Tested | Locally Integration-Tested | Live-Verified |
| :--- | :---: | :---: | :---: | :---: |
| **Mock** | Yes | Yes (100% automated) | N/A (In-Memory) | N/A |
| **Ghost CMS** | Yes | Yes (Vitest HTTP mocks) | Yes (when Docker Compose is running) | No (requires production Ghost URL & Admin Key) |
| **Lemmy** | Yes | Yes (Vitest HTTP mocks) | Yes (when Docker Compose is running) | No (requires public Lemmy community & JWT) |
| **DEV.to** | Yes | Yes (Vitest HTTP mocks) | No (external cloud service) | No (requires live API key) |
| **Discourse** | Yes | Yes (Vitest HTTP mocks) | No (requires running Discourse container) | No (requires live Discourse instance & key) |
| **HMAC Webhook** | Yes | Yes (Vitest crypto tests) | Yes (local listener) | No |
| **Assisted Packager**| Yes | Yes (Filesystem isolation) | Yes (Local filesystem) | N/A |

> [!WARNING]
> In accordance with safety rules, automated test suites run in offline/mock mode by default. Connectors are **never** reported as "Live Certified" based on mock runs.

---

## 5. Security & Isolation Guidelines

- **No Secrets in Code**: All API keys, JWT tokens, and HMAC secrets are loaded from environment variables.
- **Replay Protection**: The HMAC webhook implementation verifies timestamp drift against a configurable tolerance window (default 300s) and performs constant-time signature comparisons (`crypto.timingSafeEqual`).
- **Path Traversal Protection**: The Assisted connector strictly resolves output paths against the configured base directory and rejects traversal sequences (`../`).
