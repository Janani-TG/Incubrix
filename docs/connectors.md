# Core Connector Architecture

This document describes the core destination connector architecture for the IncuBrix Long-Tail Distribution Destination Network.

## Overview

The connector architecture provides an extensible, strongly typed abstraction layer that decouples content distribution logic from individual destination platform requirements.

```
+--------------------+
|  Application Core  |
+---------+----------+
          |
          v
+--------------------+
| Connector Registry |
+----+----------+----+
     |          |
     v          v
+---------+ +---------------------+
| Mock    | | Future Connectors   |
| (Local) | | (DEV.to, Medium...) |
+---------+ +---------------------+
```

## Core Interfaces & Types

### 1. `Connector` Interface

Defined in `src/connectors/types.ts`:

- `publish(request: PublishRequest): Promise<PublishResult>`: Publishes content to the target destination or executes a dry-run simulation.
- `verify(request: VerifyRequest): Promise<VerifyResult>`: Confirms the presence and integrity of content published on the remote destination.
- `getStatus(request: GetStatusRequest): Promise<GetStatusResult>`: Retrieves the remote lifecycle status (`published`, `draft`, `simulated`, etc.).
- `delete(request: DeleteRequest): Promise<DeleteResult>`: Removes published content from the destination platform.

### 2. Explicit Capability Representation

Platforms have asymmetric capabilities (e.g., some do not support deletion or automated verification). Instead of pretending an unsupported operation succeeded, connectors declare capabilities via `ConnectorCapabilities`:

- `canPublish: boolean`
- `canVerify: boolean`
- `canGetStatus: boolean`
- `canDelete: boolean`
- `supportsSimulation: boolean`

When an unsupported operation is invoked:
- It returns a typed result with `success: false`, `unsupported: true`, and an explanatory `unsupportedReason`.
- It never returns false positive success responses.

### 3. Simulation & Dry-Run Mechanism

Every connector that supports simulation accepts `simulate: true` in `PublishRequest` and `DeleteRequest`:
- **Publish simulation**: Generates a simulated ID (`sim-...`), validates content structure, and returns `isSimulated: true` without performing external network calls or persisting state.
- **Delete simulation**: Confirms deletion eligibility and returns `deleted: true, isSimulated: true` without removing actual records.

### 4. Connector Registry (`ConnectorRegistry`)

Defined in `src/connectors/ConnectorRegistry.ts`:
- Maintains a registry of active connectors mapped by their unique `destinationKey`.
- Enforces strict uniqueness: duplicate keys throw a `DUPLICATE_CONNECTOR` error (HTTP 409).
- Missing connectors throw a `CONNECTOR_NOT_FOUND` error (HTTP 404).

### 5. Mock Connector (`MockConnector`)

Defined in `src/connectors/MockConnector.ts`:
- Deterministic, zero-network in-memory connector for testing and local development.
- Tracks published items in memory with sequential deterministic IDs (`mock-1`, `mock-2`).
- Allows programmatic failure injection and capability customization for automated testing.

### 6. Security and Credential Guidelines

- External platform credentials must never be hardcoded into source code or test fixtures.
- All credentials should be provided via environment variables or secure secret stores at runtime.
- Error messages and logging sanitizers must strip sensitive tokens, secrets, and API keys.
