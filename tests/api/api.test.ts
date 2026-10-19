import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { destinationRulesRegistry } from '../../src/rules';

describe('Versioned REST API (/api/v1)', () => {
  const validContent = {
    title: 'Distributed Publishing Architecture',
    body: 'Exploring modular connectors and reliable idempotency.',
    summary: 'Architecture summary',
    tags: ['architecture', 'api'],
  };

  beforeEach(() => {
    // Clear rules for mock destination for baseline test
    destinationRulesRegistry.unregister('mock');
  });

  describe('Health Check Endpoint', () => {
    it('GET /health should continue returning 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Destinations Discovery', () => {
    it('GET /api/v1/destinations should list all registered connectors and declared capabilities', async () => {
      const res = await request(app).get('/api/v1/destinations');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.destinations)).toBe(true);

      const keys = res.body.destinations.map((d: any) => d.destinationKey);
      expect(keys).toContain('mock');
      expect(keys).toContain('devto');
      expect(keys).toContain('ghost');
      expect(keys).toContain('discourse');
      expect(keys).toContain('lemmy');
      expect(keys).toContain('webhook');
      expect(keys).toContain('assisted');

      // Verify capability structure
      const mockDest = res.body.destinations.find((d: any) => d.destinationKey === 'mock');
      expect(mockDest.capabilities.canPublish).toBe(true);
      expect(mockDest.capabilities.supportsSimulation).toBe(true);
    });

    it('GET /api/v1/destinations/:destinationKey should return details for a registered destination', async () => {
      const res = await request(app).get('/api/v1/destinations/devto');

      expect(res.status).toBe(200);
      expect(res.body.destination.destinationKey).toBe('devto');
      expect(res.body.destination.name).toBe('DEV.to Community');
      expect(res.body.destination.capabilities).toBeDefined();
    });

    it('GET /api/v1/destinations/:destinationKey should return 404 for unknown destinations', async () => {
      const res = await request(app).get('/api/v1/destinations/non-existent-dest');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('Content Publication (/api/v1/destinations/:destinationKey/publish)', () => {
    it('should reject publish requests missing Idempotency-Key header with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .send({ content: validContent });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
      expect(res.body.message).toContain("Header 'Idempotency-Key' is required");
    });

    it('should reject publish requests with missing content body with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', 'key-invalid-payload')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('should publish content synchronously and return HTTP 201 on success', async () => {
      const idempotencyKey = `key-sync-${Date.now()}`;
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({
          content: validContent,
          simulate: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('simulated');
      expect(res.body.isSimulated).toBe(true);
      expect(res.body.isCached).toBe(false);
    });

    it('should return cached result with HTTP 200 on repeated requests with same key and payload', async () => {
      const idempotencyKey = `key-repeat-${Date.now()}`;
      const payload = { content: validContent, simulate: true };

      // First request: HTTP 201
      const res1 = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.isCached).toBe(false);

      // Repeated request: HTTP 200 (cached)
      const res2 = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.isCached).toBe(true);
      expect(res2.body.externalId).toBe(res1.body.externalId);
    });

    it('should reject key reuse with materially different payload with HTTP 409 Conflict', async () => {
      const idempotencyKey = `key-conflict-${Date.now()}`;

      await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({ content: validContent });

      const resConflict = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', idempotencyKey)
        .send({ content: { title: 'Different Title', body: 'Different Body' } });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error).toBe('IdempotencyConflict');
    });

    it('should enforce posting rules and return HTTP 422 when content violates rules', async () => {
      // Register strict posting rule
      destinationRulesRegistry.register({
        destinationKey: 'mock',
        selfPromotion: { disallowedKeywords: ['buy now'] },
      });

      const spammyContent = {
        title: 'Spammy Post',
        body: 'Click here to buy now!',
      };

      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', `key-blocked-${Date.now()}`)
        .send({ content: spammyContent });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('RuleViolation');
      expect(res.body.decision).toBe('blocked');
      expect(Array.isArray(res.body.violations)).toBe(true);
      expect(res.body.violations.length).toBeGreaterThan(0);
    });

    it('should return HTTP 202 Accepted when async mode is requested and provide a checkStatusUrl', async () => {
      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', `key-async-${Date.now()}`)
        .send({
          content: validContent,
          async: true,
        });

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('queued');
      expect(res.body.jobId).toBeDefined();
      expect(res.body.checkStatusUrl).toContain(res.body.jobId);

      // Verify the queued job can be retrieved
      const jobRes = await request(app).get(`/api/v1/jobs/${res.body.jobId}`);
      expect(jobRes.status).toBe(200);
      expect(jobRes.body.job.id).toBe(res.body.jobId);
    });
  });

  describe('Operations (Verify, Status, Delete)', () => {
    it('POST /api/v1/destinations/:destinationKey/verify/:externalId should verify supported destination', async () => {
      const res = await request(app).post('/api/v1/destinations/mock/verify/sim-mock-123');
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
    });

    it('POST /api/v1/destinations/:destinationKey/verify/:externalId should return HTTP 501 for unsupported verify', async () => {
      const res = await request(app).post('/api/v1/destinations/webhook/verify/wh-123');
      expect(res.status).toBe(501);
      expect(res.body.error).toBe('UnsupportedCapability');
      expect(res.body.unsupported).toBe(true);
    });

    it('GET /api/v1/destinations/:destinationKey/status/:externalId should return HTTP 501 for unsupported status', async () => {
      const res = await request(app).get('/api/v1/destinations/webhook/status/wh-123');
      expect(res.status).toBe(501);
      expect(res.body.error).toBe('UnsupportedCapability');
    });

    it('DELETE /api/v1/destinations/:destinationKey/:externalId should delete supported publication', async () => {
      const res = await request(app).delete('/api/v1/destinations/mock/ext-123?simulate=true');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });

    it('DELETE /api/v1/destinations/:destinationKey/:externalId should return HTTP 501 for unsupported delete', async () => {
      const res = await request(app).delete('/api/v1/destinations/webhook/wh-123');
      expect(res.status).toBe(501);
      expect(res.body.error).toBe('UnsupportedCapability');
    });
  });

  describe('Certification API', () => {
    it('POST /api/v1/certification/run should execute certification harness in mock mode', async () => {
      const res = await request(app)
        .post('/api/v1/certification/run')
        .send({ destinationKey: 'mock', mode: 'mock' });

      expect(res.status).toBe(200);
      expect(res.body.overallSuccess).toBe(true);
      expect(res.body.reports).toHaveLength(1);
      expect(res.body.reports[0].environment).toBe('mock');
      expect(res.body.reports[0].isCertified).toBe(true);

      const runId = res.body.reports[0].runId;

      // Query report by runId
      const singleRes = await request(app).get(`/api/v1/certification/${runId}`);
      expect(singleRes.status).toBe(200);
      expect(singleRes.body.report.runId).toBe(runId);
    });

    it('GET /api/v1/certification should list all certification reports', async () => {
      const res = await request(app).get('/api/v1/certification');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.reports)).toBe(true);
    });
  });
});
