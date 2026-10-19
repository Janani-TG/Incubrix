# Integration-Test Guide & Platform Connectors

This document provides setup instructions, environment configurations, and official API documentation sources for running integration tests against the six destination connectors.

> [!IMPORTANT]
> **Safety Notice**: Automated test suites (`npm test`) run entirely offline using deterministic mocks and injected HTTP clients. Never point integration tests to public production accounts or live community subforums. Only local container instances or isolated staging environments should be used.

---

## 1. Supported Platform Connectors & Official API References

| Connector | Destination Key | Authentication | Primary API References |
| :--- | :--- | :--- | :--- |
| **DEV.to** | `devto` | `api-key: <token>` | [Forem / Dev.to API v0 Docs](https://developers.forem.com/api/v0) |
| **Ghost** | `ghost` | JWT (`Authorization: Ghost <token>`) | [Ghost Admin API Reference](https://ghost.org/docs/admin-api/) |
| **Discourse** | `discourse` | `Api-Key` & `Api-Username` | [Discourse Official API Docs](https://docs.discourse.org/) |
| **Lemmy** | `lemmy` | JWT (`auth: <token>`) | [Lemmy HTTP API v3](https://join-lemmy.org/api/index.html) |
| **HMAC Webhook** | `webhook` | HMAC-SHA256 (`t=...,v1=...`) | [Standard Webhooks Specification](https://standardwebhooks.com/) |
| **Assisted Packager**| `assisted` | Filesystem permissions | Local filesystem packager |

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env` to configure target platforms for local integration runs:

```env
# DEV.to Integration
DEVTO_API_KEY=your_sandbox_devto_api_key
DEVTO_BASE_URL=https://dev.to/api

# Ghost CMS Integration (Local or Sandbox)
# Admin key format: {24-hex-id}:{64-hex-secret}
GHOST_ADMIN_API_KEY=64f1a2b3c4d5e6f7a8b9c0d1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
GHOST_API_URL=http://localhost:2368

# Discourse Integration (Local Container)
DISCOURSE_API_KEY=your_discourse_api_key
DISCOURSE_API_USERNAME=system
DISCOURSE_BASE_URL=http://localhost:4200

# Lemmy Integration (Local Container)
LEMMY_AUTH_TOKEN=your_lemmy_jwt_token
LEMMY_INSTANCE_URL=http://localhost:8536
LEMMY_COMMUNITY_ID=1

# HMAC-Signed Webhook Integration
WEBHOOK_URL=http://localhost:9000/api/webhook
WEBHOOK_SECRET=your_32_byte_hmac_secret

# Assisted Manual Packaging Directory
ASSISTED_OUTPUT_DIR=./artifacts/assisted_packs
```

---

## 3. Local Service Setup

### Ghost CMS (Local Docker)
```bash
docker run -d --name ghost-local -p 2368:2368 -e NODE_ENV=development ghost:5-alpine
```
- Open `http://localhost:2368/ghost` to complete initial admin setup.
- Navigate to **Settings > Integrations > Add Custom Integration**.
- Copy the generated **Admin API Key** into `GHOST_ADMIN_API_KEY`.

### Lemmy (Local Docker)
Follow the official Lemmy Docker development setup:
- Instance available at `http://localhost:8536`.
- Create a test community (e.g. `c/test`).
- Obtain an account token via `POST /api/v3/user/login`.

### Discourse (Local Discourse Development / Staging)
- Instance available at `http://localhost:4200`.
- In Admin Settings, generate an API Key with `Global` scope.

---

## 4. Security & Credential Hygiene Guidelines

1. **No Hardcoded Credentials**: Source code and test fixtures strictly use environment variables or injected mocks.
2. **Credential Redaction in Logs**: HTTP headers such as `Authorization`, `api-key`, and `Api-Key` must never be logged.
3. **Replay Protection**: The HMAC webhook implementation verifies timestamp drift against a configurable tolerance window (default 300s) and performs constant-time signature comparisons (`crypto.timingSafeEqual`).
4. **Path Traversal Protection**: The Assisted connector strictly resolves output paths against the configured base directory and rejects traversal sequences (`../`).
