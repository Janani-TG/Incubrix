# Sources and References

This document records the official specifications, API documentation portals, architectural standards, and third-party libraries referenced during the design and implementation of the IncuBrix Long-Tail Distribution Destination Network.

---

## 1. Platform Connectors & Official API Documentation

### DEV.to / Forem API v0
- **URL**: [https://developers.forem.com/api/v0](https://developers.forem.com/api/v0)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**:
  - Publication endpoint: `POST /api/articles` with JSON payload (`article.title`, `article.body_markdown`, `article.tags`, `article.canonical_url`).
  - Verification & Status endpoint: `GET /api/articles/{id}` to verify publication and check `published: true/false`.
  - Deletion endpoint: `DELETE /api/articles/{id}` (permanent removal from index).
  - Authentication: `api-key: <token>` request header.
  - Tag constraints: Enforced cap of maximum 4 tags per article.

### Ghost CMS Admin API v5
- **URL**: [https://ghost.org/docs/admin-api/](https://ghost.org/docs/admin-api/)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**:
  - Publication endpoint: `POST /ghost/api/admin/posts/?source=html` with `posts` array (`title`, `html`, `custom_excerpt`, `tags`, `status: published`).
  - Verification endpoint: `GET /ghost/api/admin/posts/{id}/`.
  - Deletion endpoint: `DELETE /ghost/api/admin/posts/{id}/` (permanent deletion from database, returns HTTP 204).
  - Authentication: Custom JWT generation (`Authorization: Ghost {jwt}`). Implemented directly using pure Node.js `crypto` (`HS256`, 24-hex-char key ID, 64-hex-char secret, 5-minute expiration, `aud: '/admin/'`).

### Discourse Forum API
- **URL**: [https://docs.discourse.org/](https://docs.discourse.org/)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**:
  - Publication endpoint: `POST /posts.json` with `title`, `raw`, and optional `category`.
  - Verification endpoint: `GET /posts/{id}.json` checking `post_number`, `topic_id`, and `topic_slug`.
  - Deletion endpoint: `DELETE /posts/{id}.json` (soft-deletion tombstone retained for staff audit).
  - Authentication: `Api-Key` and `Api-Username` request headers.

### Lemmy Federated Link Aggregator API v3
- **URL**: [https://join-lemmy.org/api/index.html](https://join-lemmy.org/api/index.html)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**:
  - Publication endpoint: `POST /api/v3/post` with `name`, `body`, `community_id`, and `auth`.
  - Verification endpoint: `GET /api/v3/post?id={id}&auth={auth}`.
  - Deletion endpoint: `POST /api/v3/post/delete` with `post_id`, `deleted: true`, and `auth` (soft-deletion / tombstone required for ActivityPub federation graph consensus).
  - Authentication: User login endpoint `POST /api/v3/user/login` returning bearer JWT token.

### Standard Webhooks Specification
- **URL**: [https://standardwebhooks.com/](https://standardwebhooks.com/)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**:
  - HMAC-SHA256 signature scheme: Header format `t={timestamp},v1={hex_signature}`.
  - Canonical signing payload: `{timestamp}.{rawBody}`.
  - Security protections: Configurable timestamp drift window (default 300s) for replay attack mitigation, and constant-time signature comparison using `crypto.timingSafeEqual` to prevent timing attacks.

---

## 2. Standards & Specifications

### OpenAPI Specification 3.1.0
- **URL**: [https://spec.openapis.org/oas/v3.1.0](https://spec.openapis.org/oas/v3.1.0)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**: Schema definitions in `openapi.yaml`, full JSON Schema 2020-12 alignment, polymorphic error responses, mandatory header declarations (`Idempotency-Key`), and asynchronous 202 job references.

### IETF RFC 9110 & RFC 7231 (HTTP Semantics and Status Codes)
- **URL**: [https://www.rfc-editor.org/rfc/rfc9110.html](https://www.rfc-editor.org/rfc/rfc9110.html)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**:
  - `200 OK`: Successful synchronous execution (cached idempotency outcome, status retrieval, verification).
  - `201 Created`: Successful synchronous publication creating a new external resource.
  - `202 Accepted`: Asynchronous offloading for operations exceeding 2000ms deadline or requesting `"async": true`.
  - `400 Bad Request`: Payload validation errors or missing mandatory `Idempotency-Key` header.
  - `404 Not Found`: Unknown routes, missing destination connectors, or non-existent external IDs.
  - `409 Conflict`: Reusing an idempotency key with a materially different request payload.
  - `422 Unprocessable Content`: Destination posting-rule policy violations.
  - `501 Not Implemented`: Explicit unsupported capability responses for push-only or append-only destinations.

### IETF Draft: The Idempotency-Key HTTP Header Field
- **URL**: [https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
- **Consulted**: October 2026
- **Status**: Verified Reference
- **Usage**: Idempotency contract semantics, fingerprinting payload via cryptographic hash (SHA-256), cached response replay, and deterministic rejection of mismatched subsequent payloads.

---

## 3. Libraries & Runtimes

| Library / Tool | Version | Documentation URL | Usage in Project | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | 22.x / 24.x | [https://nodejs.org/docs/latest/api/](https://nodejs.org/docs/latest/api/) | Core runtime, `node:crypto`, `node:fs`, `node:path`. | Verified |
| **Express** | 4.21.2 | [https://expressjs.com/](https://expressjs.com/) | REST API router, JSON body parser, centralized error handler. | Verified |
| **TypeScript** | 5.7.3 | [https://www.typescriptlang.org/docs/](https://www.typescriptlang.org/docs/) | Static typing, interface contracts, compiler (`tsc`). | Verified |
| **Vitest** | 5.0.5 | [https://vitest.dev/](https://vitest.dev/) | Unit, reliability, connector, and integration test runner. | Verified |
| **Supertest** | 7.0.0 | [https://github.com/ladjs/supertest](https://github.com/ladjs/supertest) | HTTP assertion testing against Express routes. | Verified |
| **tsx** | 4.19.3 | [https://tsx.is/](https://tsx.is/) | TypeScript execution for `npm run dev` and `npm run certify`. | Verified |
| **dotenv** | 16.4.7 | [https://github.com/motdotla/dotenv](https://github.com/motdotla/dotenv) | Local environment variable management. | Verified |
| **yaml** | 2.9.1 | [https://eemeli.org/yaml/](https://eemeli.org/yaml/) | Parsing and structural schema validation of `openapi.yaml`. | Verified |

---

## 4. References Awaiting Live Production Confirmation

The following operational characteristics are documented from official API specifications but have not been exercised against live third-party production accounts in this assessment:
1. **DEV.to / Forem Live Cloud Rate Limits**: Exact dynamic `Retry-After` header behavior and quota buckets on live dev.to cloud instances.
2. **Discourse Hosted Instance Custom Plugins**: Variation in delete permissions depending on custom community plugins installed on remote third-party Discourse deployments.
