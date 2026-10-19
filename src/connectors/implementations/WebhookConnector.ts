import crypto from 'crypto';
import { BaseConnector } from '../BaseConnector';
import {
  ConnectorCapabilities,
  DeleteRequest,
  DeleteResult,
  GetStatusRequest,
  GetStatusResult,
  PublishRequest,
  PublishResult,
  VerifyRequest,
  VerifyResult,
} from '../types';
import { HttpClient } from '../http/types';
import { FetchHttpClient } from '../http/FetchHttpClient';

export interface WebhookConnectorConfig {
  destinationKey?: string;
  name?: string;
  webhookUrl?: string;
  secret?: string;
  headerPrefix?: string;
  httpClient?: HttpClient;
}

export interface WebhookSignatureVerificationOptions {
  rawBody: string;
  headerValue: string;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}

export interface WebhookSignatureVerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies an incoming HMAC-SHA256 webhook signature with replay protection.
 */
export function verifyWebhookSignature(
  options: WebhookSignatureVerificationOptions
): WebhookSignatureVerificationResult {
  const { rawBody, headerValue, secret, toleranceSeconds = 300, now = new Date() } = options;

  if (!headerValue || !secret) {
    return { valid: false, reason: 'Missing signature header or secret.' };
  }

  // Header format: t={timestamp},v1={hex_signature}
  const parts = headerValue.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));

  if (!timestampPart || !signaturePart) {
    return { valid: false, reason: 'Malformed signature header; expected "t=...,v1=...".' };
  }

  const timestamp = parseInt(timestampPart.substring(2), 10);
  const signature = signaturePart.substring(3);

  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Invalid timestamp in signature header.' };
  }

  // Replay protection: check timestamp drift
  const currentSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(currentSeconds - timestamp) > toleranceSeconds) {
    return {
      valid: false,
      reason: `Timestamp outside acceptable tolerance window of ${toleranceSeconds}s.`,
    };
  }

  // Canonical signing payload: {timestamp}.{rawBody}
  const signingPayload = `${timestamp}.${rawBody}`;
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(signingPayload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const compBuffer = Buffer.from(computedSignature);

  if (sigBuffer.length !== compBuffer.length) {
    return { valid: false, reason: 'Signature mismatch.' };
  }

  const isMatch = crypto.timingSafeEqual(sigBuffer, compBuffer);
  return {
    valid: isMatch,
    reason: isMatch ? undefined : 'Signature mismatch.',
  };
}

/**
 * Connector for generic HMAC-SHA256 signed webhooks.
 */
export class WebhookConnector extends BaseConnector {
  public readonly destinationKey: string;
  public readonly name: string;
  public readonly capabilities: ConnectorCapabilities = {
    canPublish: true,
    canVerify: false,
    canGetStatus: false,
    canDelete: false,
    supportsSimulation: true,
  };

  private webhookUrl?: string;
  private secret?: string;
  private headerPrefix: string;
  private httpClient: HttpClient;

  constructor(config: WebhookConnectorConfig = {}) {
    super();
    this.destinationKey = config.destinationKey || 'webhook';
    this.name = config.name || 'Generic HMAC Webhook';
    this.webhookUrl = config.webhookUrl || process.env.WEBHOOK_URL;
    this.secret = config.secret || process.env.WEBHOOK_SECRET;
    this.headerPrefix = config.headerPrefix || 'X-Webhook';
    this.httpClient = config.httpClient || new FetchHttpClient();
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    if (request.simulate === true) {
      const simulatedId = `sim-webhook-${Date.now()}`;
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: simulatedId,
        status: 'simulated',
        isSimulated: true,
        timestamp: this.createTimestamp(),
        metadata: { dryRun: true, ...request.metadata },
      };
    }

    const url = (request.metadata?.webhookUrl as string) || this.webhookUrl;
    if (!url) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'Webhook URL is not configured. Set WEBHOOK_URL.',
        },
      };
    }

    const secret = (request.metadata?.secret as string) || this.secret;
    if (!secret) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'Webhook HMAC secret is not configured. Set WEBHOOK_SECRET.',
        },
      };
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payloadObj = {
        event: 'content.published',
        destinationKey: this.destinationKey,
        content: request.content,
        timestamp: new Date().toISOString(),
        metadata: request.metadata,
      };

      const rawBody = JSON.stringify(payloadObj);
      const signingPayload = `${timestamp}.${rawBody}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signingPayload)
        .digest('hex');

      const signatureHeader = `t=${timestamp},v1=${signature}`;

      const response = await this.httpClient.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [`${this.headerPrefix}-Timestamp`]: String(timestamp),
          [`${this.headerPrefix}-Signature`]: signatureHeader,
        },
        body: rawBody,
      });

      const externalId = `wh-${timestamp}-${crypto.randomBytes(4).toString('hex')}`;

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId,
        status: 'published',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        metadata: {
          statusCode: response.status,
          deliveredAt: new Date().toISOString(),
        },
      };
    } catch (err: unknown) {
      const errorObj = err as any;
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: errorObj.code || 'DELIVERY_FAILED',
          message: errorObj.message || 'Webhook dispatch failed',
        },
      };
    }
  }

  public async verify(request: VerifyRequest): Promise<VerifyResult> {
    return this.createUnsupportedVerifyResult(
      request.externalId,
      'Webhook destinations are push-only and do not support active remote verification.'
    );
  }

  public async getStatus(request: GetStatusRequest): Promise<GetStatusResult> {
    return this.createUnsupportedStatusResult(
      request.externalId,
      'Webhook destinations do not support remote status querying.'
    );
  }

  public async delete(request: DeleteRequest): Promise<DeleteResult> {
    return this.createUnsupportedDeleteResult(
      request.externalId,
      'Webhook destinations do not support remote deletion.'
    );
  }
}
