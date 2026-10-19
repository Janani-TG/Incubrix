import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  WebhookConnector,
  verifyWebhookSignature,
} from '../../src/connectors/implementations/WebhookConnector';
import { MockHttpClient } from '../../src/connectors/http/MockHttpClient';
import { ContentPayload } from '../../src/connectors/types';

describe('WebhookConnector and HMAC Signature Verification', () => {
  let mockHttp: MockHttpClient;
  let connector: WebhookConnector;
  const secret = 'super-secret-hmac-key-for-testing';

  const content: ContentPayload = {
    title: 'Webhook Distribution Event',
    body: 'Automated post payload for external consumer.',
    summary: 'Webhook summary',
  };

  beforeEach(() => {
    mockHttp = new MockHttpClient();
    connector = new WebhookConnector({
      webhookUrl: 'https://example.com/api/webhooks',
      secret,
      httpClient: mockHttp,
    });
  });

  describe('HMAC Signature Generation on Publish', () => {
    it('should sign request body and include timestamp and signature headers', async () => {
      mockHttp.queueResponse({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { received: true },
      });

      const result = await connector.publish({
        destinationKey: 'webhook',
        content,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('published');
      expect(result.externalId).toMatch(/^wh-/);

      expect(mockHttp.recordedRequests).toHaveLength(1);
      const req = mockHttp.recordedRequests[0]!;
      expect(req.url).toBe('https://example.com/api/webhooks');

      const timestampHeader = req.options.headers?.['X-Webhook-Timestamp'];
      const signatureHeader = req.options.headers?.['X-Webhook-Signature'];

      expect(timestampHeader).toBeDefined();
      expect(signatureHeader).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);

      // Verify the signature using our verification helper
      const verification = verifyWebhookSignature({
        rawBody: req.options.body as string,
        headerValue: signatureHeader!,
        secret,
        toleranceSeconds: 60,
      });
      expect(verification.valid).toBe(true);
    });

    it('should support dry-run simulation without dispatching HTTP requests', async () => {
      const result = await connector.publish({
        destinationKey: 'webhook',
        content,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');
      expect(mockHttp.recordedRequests).toHaveLength(0);
    });
  });

  describe('Signature Verification and Replay Attack Protection', () => {
    const rawBody = JSON.stringify({ message: 'Hello Webhook' });
    const nowEpochSeconds = 1700000000;
    const now = new Date(nowEpochSeconds * 1000);

    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${nowEpochSeconds}.${rawBody}`)
      .digest('hex');

    const validHeader = `t=${nowEpochSeconds},v1=${validSignature}`;

    it('should verify valid HMAC signature and fresh timestamp', () => {
      const result = verifyWebhookSignature({
        rawBody,
        headerValue: validHeader,
        secret,
        toleranceSeconds: 300,
        now,
      });

      expect(result.valid).toBe(true);
    });

    it('should reject altered request body (tampering attempt)', () => {
      const tamperedBody = JSON.stringify({ message: 'Altered Body' });

      const result = verifyWebhookSignature({
        rawBody: tamperedBody,
        headerValue: validHeader,
        secret,
        toleranceSeconds: 300,
        now,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Signature mismatch.');
    });

    it('should reject invalid secret', () => {
      const result = verifyWebhookSignature({
        rawBody,
        headerValue: validHeader,
        secret: 'wrong-secret-key',
        toleranceSeconds: 300,
        now,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Signature mismatch.');
    });

    it('should reject stale timestamp outside tolerance window (replay attack)', () => {
      // 10 minutes later (600s drift > 300s tolerance)
      const tenMinutesLater = new Date((nowEpochSeconds + 600) * 1000);

      const result = verifyWebhookSignature({
        rawBody,
        headerValue: validHeader,
        secret,
        toleranceSeconds: 300,
        now: tenMinutesLater,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('outside acceptable tolerance window');
    });

    it('should reject malformed signature headers', () => {
      const result = verifyWebhookSignature({
        rawBody,
        headerValue: 'malformed-header-without-t-and-v1',
        secret,
        now,
      });

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Malformed signature header');
    });
  });

  describe('Explicit Unsupported Capabilities', () => {
    it('should explicitly report verify as unsupported', async () => {
      const res = await connector.verify({
        destinationKey: 'webhook',
        externalId: 'wh-123',
      });
      expect(res.success).toBe(false);
      expect(res.unsupported).toBe(true);
      expect(res.error?.code).toBe('UNSUPPORTED_CAPABILITY');
    });

    it('should explicitly report getStatus as unsupported', async () => {
      const res = await connector.getStatus({
        destinationKey: 'webhook',
        externalId: 'wh-123',
      });
      expect(res.success).toBe(false);
      expect(res.unsupported).toBe(true);
      expect(res.error?.code).toBe('UNSUPPORTED_CAPABILITY');
    });

    it('should explicitly report delete as unsupported', async () => {
      const res = await connector.delete({
        destinationKey: 'webhook',
        externalId: 'wh-123',
      });
      expect(res.success).toBe(false);
      expect(res.unsupported).toBe(true);
      expect(res.error?.code).toBe('UNSUPPORTED_CAPABILITY');
    });
  });
});
