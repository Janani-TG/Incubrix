import { describe, it, expect, beforeEach } from 'vitest';
import { LemmyConnector } from '../../src/connectors/implementations/LemmyConnector';
import { MockHttpClient } from '../../src/connectors/http/MockHttpClient';
import { ContentPayload } from '../../src/connectors/types';

describe('LemmyConnector', () => {
  let mockHttp: MockHttpClient;
  let connector: LemmyConnector;

  const content: ContentPayload = {
    title: 'Lemmy Link Aggregator Post',
    body: 'Discussion on open source decentralization.',
    canonicalUrl: 'https://example.com/source',
  };

  beforeEach(() => {
    mockHttp = new MockHttpClient();
    connector = new LemmyConnector({
      authToken: 'jwt-lemmy-token-12345',
      instanceUrl: 'http://localhost:8536',
      communityId: 42,
      httpClient: mockHttp,
    });
  });

  describe('Publishing', () => {
    it('should publish post to Lemmy community and normalize response', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          post_view: {
            post: {
              id: 9911,
              name: 'Lemmy Link Aggregator Post',
              ap_id: 'https://lemmy.local/post/9911',
              deleted: false,
            },
          },
        },
      });

      const result = await connector.publish({
        destinationKey: 'lemmy',
        content,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalId).toBe('9911');
      expect(result.externalUrl).toBe('https://lemmy.local/post/9911');

      expect(mockHttp.recordedRequests).toHaveLength(1);
      const req = mockHttp.recordedRequests[0]!;
      expect(req.url).toBe('http://localhost:8536/api/v3/post');
      expect((req.options.body as any).community_id).toBe(42);
      expect((req.options.body as any).auth).toBe('jwt-lemmy-token-12345');
    });

    it('should handle simulation without network requests', async () => {
      const result = await connector.publish({
        destinationKey: 'lemmy',
        content,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(mockHttp.recordedRequests).toHaveLength(0);
    });

    it('should fail when auth token is missing', async () => {
      const noAuthConnector = new LemmyConnector({
        authToken: '',
        communityId: 42,
        httpClient: mockHttp,
      });

      const result = await noAuthConnector.publish({
        destinationKey: 'lemmy',
        content,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_CONFIG_MISSING');
    });

    it('should fail when communityId is missing', async () => {
      const noCommunityConnector = new LemmyConnector({
        authToken: 'valid-token',
        communityId: undefined,
        httpClient: mockHttp,
      });

      const result = await noCommunityConnector.publish({
        destinationKey: 'lemmy',
        content,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_REQUEST');
    });
  });

  describe('Verification and Deletion', () => {
    it('should verify post exists on Lemmy', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          post_view: {
            post: {
              id: 9911,
              name: 'Post Name',
              ap_id: 'https://lemmy.local/post/9911',
              deleted: false,
            },
          },
        },
      });

      const result = await connector.verify({
        destinationKey: 'lemmy',
        externalId: '9911',
      });

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('published');
    });

    it('should delete post on Lemmy', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: {
          post_view: {
            post: {
              id: 9911,
              deleted: true,
            },
          },
        },
      });

      const result = await connector.delete({
        destinationKey: 'lemmy',
        externalId: '9911',
      });

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);
    });
  });
});
