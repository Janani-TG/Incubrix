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
import { HttpClient, HttpError } from '../http/types';
import { FetchHttpClient } from '../http/FetchHttpClient';

export interface GhostConnectorConfig {
  adminApiKey?: string;
  apiUrl?: string;
  httpClient?: HttpClient;
}

/**
 * Helper to generate a compliant Ghost Admin API JSON Web Token (JWT) using pure Node.js crypto.
 * Ghost admin key format: {id}:{secret} (24-hex-char ID and 64-hex-char secret).
 */
export function generateGhostAdminToken(key: string): string {
  const [id, secret] = key.split(':');
  if (!id || !secret || secret.length !== 64) {
    throw new Error('Invalid Ghost Admin API key format. Expected "{24-hex-id}:{64-hex-secret}".');
  }

  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 300, aud: '/admin/' };

  const toBase64Url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;

  const signature = crypto
    .createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(unsignedToken)
    .digest('base64url');

  return `${unsignedToken}.${signature}`;
}

/**
 * Connector for Ghost CMS Admin API (https://ghost.org/docs/admin-api/).
 */
export class GhostConnector extends BaseConnector {
  public readonly destinationKey = 'ghost';
  public readonly name = 'Ghost Publication';
  public readonly capabilities: ConnectorCapabilities = {
    canPublish: true,
    canVerify: true,
    canGetStatus: true,
    canDelete: true,
    supportsSimulation: true,
  };

  private adminApiKey?: string;
  private apiUrl: string;
  private httpClient: HttpClient;

  constructor(config: GhostConnectorConfig = {}) {
    super();
    this.adminApiKey = config.adminApiKey || process.env.GHOST_ADMIN_API_KEY;
    this.apiUrl = (config.apiUrl || process.env.GHOST_API_URL || 'http://localhost:2368').replace(/\/+$/, '');
    this.httpClient = config.httpClient || new FetchHttpClient();
  }

  private getAuthHeader(): string {
    if (!this.adminApiKey) {
      throw new Error('Ghost Admin API key is not configured.');
    }
    const token = generateGhostAdminToken(this.adminApiKey);
    return `Ghost ${token}`;
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    if (request.simulate === true) {
      const simulatedId = `sim-ghost-${Date.now()}`;
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: simulatedId,
        externalUrl: `${this.apiUrl}/simulated/${simulatedId}`,
        status: 'simulated',
        isSimulated: true,
        timestamp: this.createTimestamp(),
        metadata: { dryRun: true, ...request.metadata },
      };
    }

    if (!this.adminApiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'Ghost Admin API key is not configured. Set GHOST_ADMIN_API_KEY.',
        },
      };
    }

    try {
      const authHeader = this.getAuthHeader();
      const payload = {
        posts: [
          {
            title: request.content.title,
            html: request.content.body, // Ghost accepts HTML or Lexical format
            custom_excerpt: request.content.summary,
            canonical_url: request.content.canonicalUrl,
            tags: request.content.tags ? request.content.tags.map((t) => ({ name: t })) : [],
            status: 'published',
          },
        ],
      };

      const endpoint = `${this.apiUrl}/ghost/api/admin/posts/?source=html`;
      const response = await this.httpClient.request<{ posts: { id: string; url: string; status: string }[] }>(
        endpoint,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          body: payload,
        }
      );

      const post = response.data.posts?.[0];
      if (!post) {
        throw new Error('Ghost API returned response with empty posts list.');
      }

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: post.id,
        externalUrl: post.url,
        status: 'published',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        metadata: { id: post.id, url: post.url },
      };
    } catch (err: unknown) {
      return this.handleError(err);
    }
  }

  public async verify(request: VerifyRequest): Promise<VerifyResult> {
    if (!this.adminApiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: { code: 'AUTH_CONFIG_MISSING', message: 'Ghost Admin API key required.' },
      };
    }

    try {
      const authHeader = this.getAuthHeader();
      const response = await this.httpClient.request<{ posts: { id: string; url: string; status: string }[] }>(
        `${this.apiUrl}/ghost/api/admin/posts/${request.externalId}/`,
        {
          method: 'GET',
          headers: { Authorization: authHeader },
        }
      );

      const post = response.data.posts?.[0];
      if (!post) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          externalId: request.externalId,
          verified: false,
          status: 'unknown',
          timestamp: this.createTimestamp(),
          error: { code: 'NOT_FOUND', message: 'Post not found.' },
        };
      }

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: post.id,
        verified: true,
        status: post.status === 'published' ? 'published' : 'draft',
        externalUrl: post.url,
        timestamp: this.createTimestamp(),
      };
    } catch (err: unknown) {
      if (err instanceof HttpError && err.statusCode === 404) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          externalId: request.externalId,
          verified: false,
          status: 'unknown',
          timestamp: this.createTimestamp(),
          error: { code: 'NOT_FOUND', message: `Post '${request.externalId}' not found on Ghost.` },
        };
      }
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: { code: (err as any).code || 'VERIFY_FAILED', message: (err as Error).message },
      };
    }
  }

  public async getStatus(request: GetStatusRequest): Promise<GetStatusResult> {
    const verifyOutcome = await this.verify({
      destinationKey: this.destinationKey,
      externalId: request.externalId,
    });

    return {
      success: verifyOutcome.success,
      destinationKey: this.destinationKey,
      externalId: request.externalId,
      status: verifyOutcome.status,
      timestamp: this.createTimestamp(),
      error: verifyOutcome.error,
      details: verifyOutcome.externalUrl ? { url: verifyOutcome.externalUrl } : undefined,
    };
  }

  public async delete(request: DeleteRequest): Promise<DeleteResult> {
    if (request.simulate === true) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: true,
        isSimulated: true,
        timestamp: this.createTimestamp(),
      };
    }

    if (!this.adminApiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: { code: 'AUTH_CONFIG_MISSING', message: 'Ghost Admin API key required for deletion.' },
      };
    }

    try {
      const authHeader = this.getAuthHeader();
      await this.httpClient.request(
        `${this.apiUrl}/ghost/api/admin/posts/${request.externalId}/`,
        {
          method: 'DELETE',
          headers: { Authorization: authHeader },
        }
      );

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: true,
        isSimulated: false,
        timestamp: this.createTimestamp(),
      };
    } catch (err: unknown) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: { code: (err as any).code || 'DELETE_FAILED', message: (err as Error).message },
      };
    }
  }

  private handleError(err: unknown): PublishResult {
    const errorObj = err as any;
    return {
      success: false,
      destinationKey: this.destinationKey,
      status: 'failed',
      isSimulated: false,
      timestamp: this.createTimestamp(),
      error: {
        code: errorObj.code || 'PUBLISH_FAILED',
        message: errorObj.message || 'Ghost publication failed',
      },
    };
  }
}
