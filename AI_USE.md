# AI Usage Disclosure

In compliance with assessment transparency and academic integrity guidelines, this document outlines the extent, methodologies, and human verification processes involved in using AI assistance during the development of the IncuBrix Long-Tail Distribution Destination Network.

---

## 1. Overview of AI Assistance

AI coding assistance (via the Antigravity AI pair-programming assistant) was utilized throughout this project as an interactive development partner. The candidate directed architecture planning, stage sequencing, requirement decomposition, review, and verification, while the AI assisted in generating initial boilerplate, implementing typed interfaces, drafting test suites, and producing documentation.

---

## 2. Development Workflow

Development followed a strict, incremental stage-by-stage workflow:

1. **Stage Scoping & Prompting**:
   - The candidate provided concrete objectives, architectural constraints, and task definitions for each stage (Stage 1 through Stage 8).
   - Constraints strictly prohibited modifying working components, inventing unverified features, or pushing code to GitHub.

2. **Code Generation & Architecture Refinement**:
   - The AI generated TypeScript source code, domain models, Express route handlers, and Vitest test fixtures.
   - Specific implementation details—such as Node.js native crypto JWT generation for Ghost (`HS256`), constant-time HMAC comparison for Webhooks (`timingSafeEqual`), and ActivityPub soft-deletion semantics for Lemmy—were generated in accordance with official API specifications.

3. **Automated Verification**:
   - Every file modification was immediately followed by automated command execution via the CLI:
     - TypeScript type-checking and compilation: `npm run build` (`tsc`).
     - Vitest automated test execution: `npm test` and `npm run test:integration`.
     - Docker syntax validation: `docker compose config` and `docker build`.
   - Any compilation errors or failing test assertions were analyzed and resolved before moving to the next task.

4. **Human Review & Git Auditing**:
   - The candidate reviewed git diffs (`git status`, `git diff`) at every stage boundary.
   - All Git staging (`git add`) and commit operations (`git commit`) were executed explicitly by the candidate.

---

## 3. Scope of Automated Evidence vs. Manual Verification

To maintain complete honesty regarding test outcomes:

- **Automated Offline Evidence**:
  - Exactly **176 tests across 25 test files** pass deterministically in the local test environment via `vitest run`.
  - All automated tests run offline using in-memory stores, injected mock HTTP clients (`MockHttpClient`), and simulated responses (`simulate: true`).
  - Zero external network requests were made during automated testing.

- **Local Docker Services Integration**:
  - Multi-container configuration (`docker-compose.yml`) was authored and validated syntactically via `docker compose config`.
  - The local service test suite (`tests/integration/localServices.test.ts`) probes container ports (`2368` and `8536`). During the automated test runs, external local services were not booted and credentials were not configured; these tests were **safely and cleanly skipped** with descriptive diagnostic logs. They are **not** claimed as executed live tests.

- **Live Third-Party Cloud Verification**:
  - No automated tests published real content to live public accounts on DEV.to, production Ghost publications, live Discourse forums, or public Lemmy instances.
  - Live tests require explicit opt-in (`--live`) and valid credentials in `.env`, which were intentionally excluded to prevent accidental public posting.

---

## 4. Human Oversight Summary

| Area | AI Role | Human Candidate Role |
| :--- | :--- | :--- |
| **Requirements** | Analyzed assessment brief constraints and synthesized implementation checklists. | Directed stage sequencing, verified scope, and enforced assessment rules. |
| **Code Implementation** | Drafted TypeScript modules, classes, and middleware. | Reviewed architecture, confirmed method signatures, and audited code diffs. |
| **Testing** | Generated unit, integration, and E2E test suites with deterministic fixtures. | Verified test results, executed CLI commands, and ensured tests do not fabricate live claims. |
| **Docker Configuration** | Authored `Dockerfile`, `docker-compose.yml`, and `lemmy.hjson`. | Reviewed container specs, verified image build, and ensured safe local defaults. |
| **Version Control** | Formatted summaries of changed files. | Executed `git add`, `git commit`, and maintained clean Git history. |
