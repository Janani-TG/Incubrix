import { describe, it, expect, beforeEach } from 'vitest';
import { DiscourseConnector } from '../../src/connectors/implementations/DiscourseConnector';
import { MockHttpClient } from '../../src/connectors/http/MockHttpClient';
import { ContentPayload } from '../../src/connectors/types';

describe('DiscourseConnector', () => {
  let mockHttp: MockHttpClient;
  let connector: DiscourseConnector;

  const content: ContentPayload = {
    title: 'Discourse Forum Topic Discussion',
    body: 'This is the raw content of the forum post.',
  };

  beforeEach(() => {
    mockHttp = new MockHttpClient();
    connector = new DiscourseConnector({
      apiKey: 'test-discourse-api-key',
      apiUsername: 'moderator',
      baseUrl: 'http://localhost:4200',
      httpClient: mockHttp,
    });
  });

  describe('Publishing', () => {
    it('should publish topic and construct forum URL', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          id: 5544,
          post_number: 1,
          topic_id: 2211,
          topic_slug: 'discourse-forum-topic-discussion',
        },
      });

      const result = await connector.publish({
        destinationKey: 'discourse',
        content,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalId).toBe('5544');
      expect(result.externalUrl).toBe('http://localhost:4200/t/discourse-forum-topic-discussion/2211/1');

      expect(mockHttp.recordedRequests).toHaveLength(1);
      const req = mockHttp.recordedRequests[0]!;
      expect(req.options.headers?.['Api-Key']).toBe('test-discourse-api-key');
      expect(req.options.headers?.['Api-Username']).toBe('moderator');
    });

    it('should handle simulation without network calls', async () => {
      const result = await connector.publish({
        destinationKey: 'discourse',
        content,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(mockHttp.recordedRequests).toHaveLength(0);
    });

    it('should fail with AUTH_CONFIG_MISSING if API key is not configured', async () => {
      const noKeyConnector = new DiscourseConnector({
        apiKey: '',
        httpClient: mockHttp,
      });

      const result = await noKeyConnector.publish({
        destinationKey: 'discourse',
        content,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_CONFIG_MISSING');
    });
  });

  describe('Verification and Deletion', () => {
    it('should verify post exists', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          id: 5544,
          post_number: 1,
          topic_id: 2211,
          topic_slug: 'discourse-topic',
        },
      });

      const result = await connector.verify({
        destinationKey: 'discourse',
        externalId: '5544',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('published');
    });

    it('should delete post on Discourse', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { success: 'OK' },
      });

      const result = await connector.delete({
        destinationKey: 'discourse',
        externalId: '5544',
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });
});
