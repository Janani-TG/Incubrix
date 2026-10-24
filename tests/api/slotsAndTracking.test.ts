import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { destinationRulesRegistry } from '../../src/rules';

describe('API: Verified Tracking Links & Publishing Slots', () => {
  const app = createApp();

  beforeEach(() => {
    destinationRulesRegistry.clear();
  });

  describe('GET /api/v1/destinations/:destinationKey/slots', () => {
    it('should return unconfigured status when destination has no slots configured', async () => {
      const res = await request(app).get('/api/v1/destinations/devto/slots');

      expect(res.status).toBe(200);
      expect(res.body.destinationKey).toBe('devto');
      expect(res.body.slotsConfigured).toBe(false);
      expect(res.body.isWithinSlot).toBe(true);
      expect(res.body.slots).toEqual([]);
    });

    it('should return slot details and capacity when publishing slots are configured', async () => {
      destinationRulesRegistry.register({
        destinationKey: 'devto',
        publishingSlots: {
          enabled: true,
          timezone: 'UTC',
          slots: [
            {
              name: 'Universal Day Slot',
              start: '00:00',
              end: '23:59',
              maxPostsPerSlot: 5,
            },
          ],
        },
      });

      const res = await request(app).get('/api/v1/destinations/devto/slots');

      expect(res.status).toBe(200);
      expect(res.body.destinationKey).toBe('devto');
      expect(res.body.slotsConfigured).toBe(true);
      expect(res.body.slots).toHaveLength(1);
      expect(res.body.slots[0].maxPostsPerSlot).toBe(5);
      expect(res.body.slots[0].remainingCapacity).toBeDefined();
    });

    it('should return 404 for unknown destination', async () => {
      const res = await request(app).get('/api/v1/destinations/nonexistent/slots');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('POST /api/v1/tracking/verify', () => {
    it('should verify a valid tracking URL', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/verify')
        .send({
          url: 'https://incubrix.io/docs?utm_source=devto&utm_medium=syndication',
          destinationKey: 'devto',
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.isTracking).toBe(true);
      expect(res.body.violations).toHaveLength(0);
    });

    it('should report violations for invalid tracking parameters against destination rules', async () => {
      destinationRulesRegistry.register({
        destinationKey: 'devto',
        trackingLinks: {
          enabled: true,
          requireHttps: true,
          enforceDestinationUtmSource: true,
          requiredTrackingParams: ['utm_source', 'utm_medium', 'utm_campaign'],
        },
      });

      const res = await request(app)
        .post('/api/v1/tracking/verify')
        .send({
          url: 'https://incubrix.io/docs?utm_source=ghost&utm_medium=syndication',
          destinationKey: 'devto',
        });

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.violations.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing url', async () => {
      const res = await request(app).post('/api/v1/tracking/verify').send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('POST /api/v1/tracking/generate', () => {
    it('should generate a compliant tracking URL with standard parameters', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/generate')
        .send({
          baseUrl: 'https://incubrix.io/features',
          destinationKey: 'ghost',
          utmMedium: 'blog',
          utmCampaign: 'launch_v1',
        });

      expect(res.status).toBe(200);
      expect(res.body.trackingUrl).toContain('https://incubrix.io/features');
      expect(res.body.trackingUrl).toContain('utm_source=ghost');
      expect(res.body.trackingUrl).toContain('utm_medium=blog');
      expect(res.body.trackingUrl).toContain('utm_campaign=launch_v1');
    });

    it('should generate a cryptographically signed tracking URL when sign is true', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/generate')
        .send({
          baseUrl: 'https://incubrix.io/features',
          destinationKey: 'devto',
          sign: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.isSigned).toBe(true);
      expect(res.body.trackingUrl).toContain('sig=');
    });

    it('should return 400 for malformed baseUrl', async () => {
      const res = await request(app)
        .post('/api/v1/tracking/generate')
        .send({
          baseUrl: 'not-a-valid-url',
          destinationKey: 'devto',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('Guarded Publishing with Tracking Links & Slots', () => {
    it('should block publish request when content contains unverified tracking links', async () => {
      destinationRulesRegistry.register({
        destinationKey: 'mock',
        trackingLinks: {
          enabled: true,
          requireHttps: true,
          enforceDestinationUtmSource: true,
        },
      });

      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', 'test-tracking-block-1')
        .send({
          content: {
            title: 'Test Article',
            body: 'Check out [Link](http://insecure-link.com?utm_source=wrong_source)',
          },
          simulate: true,
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('RuleViolation');
      expect(res.body.decision).toBe('blocked');
      expect(res.body.violations.some((v: any) => v.ruleId === 'RULE_TRACKING_LINKS')).toBe(true);
    });

    it('should allow publish request when tracking links comply with destination policy', async () => {
      destinationRulesRegistry.register({
        destinationKey: 'mock',
        trackingLinks: {
          enabled: true,
          requireHttps: true,
          enforceDestinationUtmSource: true,
        },
      });

      const res = await request(app)
        .post('/api/v1/destinations/mock/publish')
        .set('Idempotency-Key', 'test-tracking-allow-1')
        .send({
          content: {
            title: 'Test Article',
            body: 'Check out [Link](https://incubrix.io?utm_source=mock&utm_medium=syndication)',
          },
          simulate: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.decision).toBe('allowed');
      expect(res.body.success).toBe(true);
    });
  });
});
