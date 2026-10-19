import { describe, it, expect, beforeEach } from 'vitest';
import { DevtoConnector } from '../../src/connectors/implementations/DevtoConnector';
import { MockHttpClient } from '../../src/connectors/http/MockHttpClient';
import { ContentPayload } from '../../src/connectors/types';

describe('DevtoConnector', () => {
  let mockHttp: MockHttpClient;
  let connector: DevtoConnector;

  const content: ContentPayload = {
    title: 'Building Modern Backend Connectors',
    body: '## Overview\nThis article explains connector design patterns.',
    summary: 'A guide to backend connectors',
    tags: ['typescript', 'node', 'architecture'],
    canonicalUrl: 'https://example.com/canonical-post',
  };

  beforeEach(() => {
    mockHttp = new MockHttpClient();
    connector = new DevtoConnector({
      apiKey: 'test-devto-api-key',
      baseUrl: 'https://dev.to/api',
      httpClient: mockHttp,
    });
  });

  describe('Capabilities', () => {
    it('should declare correct supported capabilities', () => {
      expect(connector.capabilities.canPublish).toBe(true);
      expect(connector.capabilities.canVerify).toBe(true);
      expect(connector.capabilities.canGetStatus).toBe(true);
      expect(connector.capabilities.canDelete).toBe(true);
      expect(connector.capabilities.supportsSimulation).toBe(true);
    });
  });

  describe('Publishing', () => {
    it('should publish article and normalize response', async () => {
      mockHttp.queueResponse({
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: {
          id: 998877,
          url: 'https://dev.to/user/building-modern-backend-connectors-xyz',
          published: true,
        },
      });

      const result = await connector.publish({
        destinationKey: 'devto',
        content,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalId).toBe('998877');
      expect(result.externalUrl).toBe('https://dev.to/user/building-modern-backend-connectors-xyz');
      expect(result.isSimulated).toBe(false);

      // Verify request payload sent to HTTP client
      expect(mockHttp.recordedRequests).toHaveLength(1);
      const req = mockHttp.recordedRequests[0]!;
      expect(req.url).toBe('https://dev.to/api/articles');
      expect(req.options.headers?.['api-key']).toBe('test-devto-api-key');
      expect((req.options.body as any).article.title).toBe(content.title);
    });

    it('should handle dry-run simulation without making HTTP calls', async () => {
      const result = await connector.publish({
        destinationKey: 'devto',
        content,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(result.externalId).toMatch(/^sim-devto-/);
      expect(mockHttp.recordedRequests).toHaveLength(0);
    });

    it('should return error when API key is missing', async () => {
      const noKeyConnector = new DevtoConnector({
        apiKey: '',
        httpClient: mockHttp,
      });

      const result = await noKeyConnector.publish({
        destinationKey: 'devto',
        content,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_CONFIG_MISSING');
      expect(mockHttp.recordedRequests).toHaveLength(0);
    });

    it('should handle HTTP error responses cleanly', async () => {
      mockHttp.queueResponse({
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/json' },
        data: { error: 'Validation failed: Title is too short' },
      });

      const result = await connector.publish({
        destinationKey: 'devto',
        content,
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Verification and Status', () => {
    it('should verify published article', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          id: 998877,
          url: 'https://dev.to/user/article-link',
          published: true,
        },
      });

      const result = await connector.verify({
        destinationKey: 'devto',
        externalId: '998877',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('published');
    });

    it('should return verified: false on 404', async () => {
      mockHttp.queueResponse({
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' },
        data: { error: 'Not found' },
      });

      const result = await connector.verify({
        destinationKey: 'devto',
        externalId: '998877',
      });

      expect(result.success).toBe(false);
      expect(result.verified).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Deletion', () => {
    it('should delete article and return deleted: true', async () => {
      mockHttp.queueResponse({
        status: 204,
        statusText: 'No Content',
        headers: {},
        data: null,
      });

      const result = await connector.delete({
        destinationKey: 'devto',
        externalId: '998877',
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });
});
