# Posting-Rules Engine Architecture

This document describes the destination posting-rules engine for the IncuBrix Long-Tail Distribution Destination Network.

> [!NOTE]
> **Illustrative Rule Notice**: All rule configurations and limits detailed herein are configurable templates. In accordance with system design guidelines, no official platform policies are assumed or hardcoded; all destination policies remain illustrative until verified against authoritative destination documentation.

---

## Architecture Overview

The posting-rules engine evaluates content payloads against destination-specific policy configurations *before* any publishing operation is permitted.

```
+-------------------------------------------------------+
|                 Publish Request                       |
|           (Live or Dry-Run Simulation)                |
+---------------------------+---------------------------+
                            |
                            v
+-------------------------------------------------------+
|             PostingRulesEngine.evaluate()             |
|                                                       |
|  - Frequency & Cooldown Limits                        |
|  - Self-Promotion Checks (links & keywords)           |
|  - Link Restrictions (count, HTTPS, domains)          |
|  - AI Disclosure Verification (phrases & tags)        |
+---------------------------+---------------------------+
                            |
            +---------------+---------------+
            |                               |
       [Blocked]                        [Allowed]
            |                               |
            v                               v
+-----------------------+       +-----------------------+
| Immediate Rejection   |       | Connector.publish()   |
| (Connector NEVER hit) |       | (Live or Simulated)   |
+-----------------------+       +-----------+-----------+
                                            |
                                            v (if successful & not simulated)
                                +-----------------------+
                                | Record in History     |
                                | (PublicationHistory)  |
                                +-----------------------+
```

---

## Core Capabilities & Rule Categories

### 1. Publishing Frequency Limits (`RULE_FREQUENCY_LIMIT`)
- **Sliding Window Cap**: Restricts maximum allowed publications within a sliding window (e.g. `maxPosts: 2` per `windowSeconds: 3600`).
- **Cooldown Interval**: Enforces a minimum time separation between consecutive posts (e.g. `cooldownSeconds: 60`).
- **Deterministic Testing**: Tested using the `Clock` (`ControllableClock`) and `PublicationHistoryStore` abstractions. No real-time timers or sleep waits are used in automated tests.

### 2. Self-Promotion Restrictions (`RULE_SELF_PROMOTION`)
- **Promotional Links**: Restricts links pointing to designated promotional domains (e.g., author webshops or affiliate domains).
- **Prohibited Keywords**: Detects and restricts sales/promotional phrases (e.g. `"buy now"`, `"discount code"`, `"affiliate link"`).

### 3. Link Restrictions (`RULE_LINK_RESTRICTIONS`)
- **Quantity Cap**: Limits total link count in title, body, and summary (`maxLinks`).
- **Protocol Enforcement**: Enforces `requireHttps: true` to prevent insecure (`http://`) link insertion.
- **Domain Blacklists & Whitelists**: Blocks link shorteners / unauthorized domains (`disallowedDomains`) and enforces whitelists (`allowedDomains`).

### 4. AI Disclosure Requirements (`RULE_AI_DISCLOSURE`)
- **Conditional & Global Mandates**: Requires disclosure if content is marked as AI-assisted or if the destination mandates disclosure for all content.
- **Verification Methods**: Complies if either a recognized disclaimer phrase (e.g. `"generated with ai"`, `"ai-assisted"`) is present in the text OR a required disclosure tag (e.g. `ai-generated`) is included.

### 5. Verified Tracking Links (`RULE_TRACKING_LINKS`)
- **Attribution & UTM Parameters**: Enforces standard query parameters (e.g. `utm_source`, `utm_medium`, `utm_campaign`).
- **Destination Source Validation**: Can strictly enforce that `utm_source` matches the target destination (`enforceDestinationUtmSource`).
- **Domain Verification**: Enforces allowed tracking domains (`allowedTrackingDomains`) and blocks deceptive redirectors/shorteners (`disallowedTrackingDomains`).
- **Cryptographic Signatures**: Supports HMAC-SHA256 URL signatures (`?sig=...`) to ensure tracking links have not been altered or forged.
- **Protocol Enforcement**: Enforces `requireHttps: true` on all tracking links.

### 6. Publishing Slots & Scheduling (`RULE_PUBLISHING_SLOTS`)
- **Time Windows**: Configurable 24-hour time slots (`HH:mm` start and end) with timezone support (e.g. `UTC`).
- **Day-of-Week Policies**: Restricts publishing to approved days (e.g. weekdays only: `daysOfWeek: [1, 2, 3, 4, 5]`).
- **Slot Capacity Quotas**: Enforces maximum publications per active slot (`maxPostsPerSlot`) evaluated against `PublicationHistoryStore`.
- **Next Slot Prediction**: When rejected outside of an active slot, details the exact start time of the next available publishing window.
- **Slot Inspection API**: Dedicated endpoint `GET /api/v1/destinations/:destinationKey/slots` exposing active slot status and remaining capacity.

---

## Guarded Publishing Pipeline (`GuardedPublishService`)

To eliminate accidental publication of non-compliant content, the `GuardedPublishService` encapsulates the connector dispatch:
1. Destination lookup via `ConnectorRegistry`.
2. Content evaluation via `PostingRulesEngine`.
3. If blocked: Returns `{ decision: 'blocked', success: false }` with all violations. The underlying connector's `publish()` method is **guaranteed never to be invoked**.
4. If allowed: Proceeds to `connector.publish(request)`.
5. Upon successful live publication, the event is recorded into `PublicationHistoryStore` for future frequency accounting.

---

## Simulation Safety Guarantee

- **Simulation Does NOT Bypass Rules**: Dry-run simulations (`simulate: true`) undergo full rule evaluation. Content that violates destination rules will be blocked identically to live publishing requests.
- **Simulation Does NOT Consume Quota**: Allowed dry-run simulations do not record entries in `PublicationHistoryStore`, ensuring test and preview runs do not exhaust production rate limits.
