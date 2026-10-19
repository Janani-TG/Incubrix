import { describe, it, expect, beforeEach } from 'vitest';
import {
  GhostConnector,
  generateGhostAdminToken,
} from '../../src/connectors/implementations/GhostConnector';
import { MockHttpClient } from '../../src/connectors/http/MockHttpClient';
import { ContentPayload } from '../../src/connectors/types';

describe('GhostConnector', () => {
  let mockHttp: MockHttpClient;
  let connector: GhostConnector;

  // 24 hex char ID + 64 hex char secret
  const validKey = '64f1a2b3c4d5e6f7a8b9c0d1:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const content: ContentPayload = {
    title: 'Publishing to Ghost CMS',
    body: '<p>This is a test post body for Ghost.</p>',
    summary: 'Ghost CMS publication test',
    tags: ['ghost', 'cms'],
  };

  beforeEach(() => {
    mockHttp = new MockHttpClient();
    connector = new GhostConnector({
      adminApiKey: validKey,
      apiUrl: 'http://localhost:2368',
      httpClient: mockHttp,
    });
  });

  describe('JWT Token Generation', () => {
    it('should generate valid 3-part base64url JWT with kid and HS256', () => {
      const token = generateGhostAdminToken(validKey);
      const parts = token.split('.');
      expect(parts).toHaveLength(3);

      const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf8'));
      expect(header.alg).toBe('HS256');
      expect(header.kid).toBe('64f1a2b3c4d5e6f7a8b9c0d1');

      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
      expect(payload.aud).toBe('/admin/');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should reject malformed Ghost Admin API keys', () => {
      expect(() => generateGhostAdminToken('invalid-key')).toThrow();
      expect(() => generateGhostAdminToken('shortid:shortsecret')).toThrow();
    });
  });

  describe('Publishing', () => {
    it('should publish post and return published status', async () => {
      mockHttp.queueResponse({
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: {
          posts: [
            {
              id: 'ghost-post-123',
              url: 'http://localhost:2368/publishing-to-ghost-cms/',
              status: 'published',
            },
          ],
        },
      });

      const result = await connector.publish({
        destinationKey: 'ghost',
        content,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalId).toBe('ghost-post-123');
      expect(result.externalUrl).toBe('http://localhost:2368/publishing-to-ghost-cms/');

      expect(mockHttp.recordedRequests).toHaveLength(1);
      const req = mockHttp.recordedRequests[0]!;
      expect(req.options.headers?.Authorization).toMatch(/^Ghost /);
    });

    it('should handle dry-run simulation without making network requests', async () => {
      const result = await connector.publish({
        destinationKey: 'ghost',
        content,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(mockHttp.recordedRequests).toHaveLength(0);
    });
  });

  describe('Verification and Deletion', () => {
    it('should verify existing post', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          posts: [
            {
              id: 'ghost-post-123',
              url: 'http://localhost:2368/post-url',
              status: 'published',
            },
          ],
        },
      });

      const result = await connector.verify({
        destinationKey: 'ghost',
        externalId: 'ghost-post-123',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('published');
    });

    it('should delete post on Ghost', async () => {
      mockHttp.queueResponse({
        status: 204,
        statusText: 'No Content',
        headers: {},
        data: null,
      });

      const result = await connector.delete({
        destinationKey: 'ghost',
        externalId: 'ghost-post-123',
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });
});
