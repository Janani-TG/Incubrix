import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { destinationRulesRegistry } from '../../src/rules';

describe('End-to-End API Integration Suite', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
    destinationRulesRegistry.unregister('devto');
    destinationRulesRegistry.unregister('mock');
  });

  afterEach(() => {
    destinationRulesRegistry.unregister('devto');
    destinationRulesRegistry.unregister('mock');
  });

  describe('1. Health Check Endpoint', () => {
    it('should return 200 OK with health status and uptime', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.environment).toBeDefined();
    });
  });

  describe('2. Posting-Rule Enforcement Before Publishing', () => {
    it('should reject content violating frequency or self-promotion rules with HTTP 422 before connector is called', async () => {
      // Configure strict posting rules for devto
      destinationRulesRegistry.register({
        destinationKey: 'devto',
        selfPromotion: { disallowedKeywords: ['sponsored', 'pricing'] },
        linkRestrictions: { maxLinks: 2 },
      });

      const blockedPayload = {
        content: {
          title: 'Sponsored Promo Post with Multiple Self Links',
          body: [
            'This is a sponsored post about our tool.',
            'Visit our pricing at https://myservice.io/pricing and sign up.',
            'Check out https://myservice.io/features and https://myservice.io/enterprise now!',
            'Also see https://myservice.io/blog for more promo details.',
          ].join(' '),
          summary: 'Promo summary',
        },
        simulate: true,
      };

      const res = await request(app)
        .post('/api/v1/destinations/devto/publish')
        .set('Idempotency-Key', 'e2e-blocked-test-001')
        .send(blockedPayload);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('RuleViolation');
      expect(res.body.decision).toBe('blocked');
      expect(Array.isArray(res.body.violations)).toBe(true);
      expect(res.body.violations.length).toBeGreaterThan(0);
    });

    it('should allow valid content passing all posting rules', async () => {
      const allowedPayload = {
        content: {
          title: 'Valid Educational Article on Long-Tail Architecture',
          body: 'Here is an in-depth technical analysis of modular connectors without self promotion.',
          summary: 'Technical guide',
          tags: ['architecture', 'typescript'],
        },
        simulate: true,
      };

      const res = await request(app)
        .post('/api/v1/destinations/devto/publish')
        .set('Idempotency-Key', 'e2e-allowed-test-001')
        .send(allowedPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.decision).toBe('allowed');
      expect(res.body.status).toBe('simulated');
    });
  });

  describe('3. Exactly-Once Idempotency Semantics', () => {
    const validContent = {
      title: 'Idempotency Guarantee Verification',
      body: 'Testing duplicate request deduplication across distribution networks.',
      summary: 'Idempotency test',
      tags: ['test', 'idempotency'],
    };

    it('should return cached response with HTTP 200 on duplicate request with identical payload', async () => {
      const idempotencyKey = 'e2e-idem-key-duplicate-001';

      // First execution -> 201 Created
      const firstRes = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({ content: validContent, simulate: true });

      expect(firstRes.status).toBe(201);
      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.isCached).toBe(false);
      const originalExternalId = firstRes.body.externalId;

      // Duplicate execution with exact same payload -> 200 OK (cached)
      const secondRes = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({ content: validContent, simulate: true });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.isCached).toBe(true);
      expect(secondRes.body.externalId).toBe(originalExternalId);
    });

    it('should reject request with HTTP 409 when reusing key with materially different payload', async () => {
      const idempotencyKey = 'e2e-idem-key-conflict-001';

      // First execution
      await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({ content: validContent, simulate: true });

      // Second execution with different title
      const conflictRes = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          content: {
            ...validContent,
            title: 'Materially Different Title',
          },
          simulate: true,
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error).toBe('IdempotencyConflict');
      expect(conflictRes.body.message).toContain('different request payload');
    });

    it('should require Idempotency-Key header and reject with HTTP 400 when missing', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .send({ content: validContent });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
      expect(res.body.message).toContain('Idempotency-Key');
    });
  });

  describe('4. Asynchronous Background Jobs & Threshold Transition', () => {
    it('should accept async publishing requests with HTTP 202 and provide trackable status URL', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', 'e2e-async-job-001')
        .send({
          content: {
            title: 'Asynchronous Large Document Publication',
            body: 'Body content designed for background queue processing.',
          },
          async: true,
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
      expect(res.body.jobId).toBeDefined();
      expect(res.body.checkStatusUrl).toContain(res.body.jobId);

      // Verify job retrieval endpoint
      const jobRes = await request(app).get(res.body.checkStatusUrl);
      expect(jobRes.status).toBe(200);
      expect(jobRes.body.job.id).toBe(res.body.jobId);
      expect(jobRes.body.job.destinationKey).toBe('mock');
      expect(['queued', 'running', 'succeeded']).toContain(jobRes.body.job.status);
    });

    it('should return 404 for non-existent job ID', async () => {
      const res = await request(app).get('/api/v1/jobs/non-existent-job-999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('5. Publication Lifecycle: Verify, GetStatus, and Delete', () => {
    it('should execute full lifecycle on mock connector', async () => {
      // 1. Publish
      const pubRes = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', 'e2e-lifecycle-mock-001')
        .send({
          content: {
            title: 'Lifecycle Item',
            body: 'Body content for full lifecycle verification.',
          },
        });

      expect(pubRes.status).toBe(201);
      const externalId = pubRes.body.externalId;
      expect(externalId).toBeDefined();

      // 2. Verify
      const verifyRes = await request(app)
        .post(`/api/v1/destinations/mock/verify/${externalId}`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.verified).toBe(true);

      // 3. Status
      const statusRes = await request(app)
        .get(`/api/v1/destinations/mock/status/${externalId}`);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.status).toBe('published');

      // 4. Delete
      const deleteRes = await request(app)
        .delete(`/api/v1/destinations/mock/${externalId}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.deleted).toBe(true);

      // 5. Subsequent verify should return 404
      const reVerifyRes = await request(app)
        .post(`/api/v1/destinations/mock/verify/${externalId}`);
      expect(reVerifyRes.status).toBe(404);
    });

    it('should return HTTP 501 UnsupportedCapability for undeclared operations on webhook', async () => {
      // Webhook connector does not support verify or delete
      const verifyRes = await request(app)
        .post('/api/v1/destinations/webhook/verify/fake-id');
      expect(verifyRes.status).toBe(501);
      expect(verifyRes.body.unsupported).toBe(true);

      const deleteRes = await request(app)
        .delete('/api/v1/destinations/webhook/fake-id');
      expect(deleteRes.status).toBe(501);
      expect(deleteRes.body.unsupported).toBe(true);
    });
  });

  describe('6. Error Handling & Parameter Validation', () => {
    it('should return HTTP 404 for unknown destination', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/unknown-destination-xyz/publish')
        .set('Idempotency-Key', 'e2e-unknown-001')
        .send({
          content: { title: 'Test', body: 'Test' },
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });

    it('should return HTTP 400 for empty or missing content title', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', 'e2e-invalid-title-001')
        .send({
          content: { title: '   ', body: 'Valid body' },
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should return HTTP 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/unknown-path-does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('7. Certification Harness via REST API', () => {
    it('should run mock certification suite via POST /api/v1/certification/run', async () => {
      const res = await request(app)
        .post('/api/v1/certification/run')
        .send({
          destinationKey: 'mock',
          mode: 'mock',
        });

      expect(res.status).toBe(200);
      expect(res.body.overallSuccess).toBe(true);
      expect(res.body.reports).toBeDefined();
      expect(res.body.reports.length).toBe(1);

      const report = res.body.reports[0];
      expect(report.destinationKey).toBe('mock');
      expect(report.environment).toBe('mock');
      expect(report.isCertified).toBe(true);
      expect(report.summary.passed).toBeGreaterThanOrEqual(4);

      // Verify retrieval by runId
      const getRes = await request(app).get(`/api/v1/certification/${report.runId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.report.runId).toBe(report.runId);
    });
  });
});
