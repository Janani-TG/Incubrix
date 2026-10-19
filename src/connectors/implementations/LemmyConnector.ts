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

export interface LemmyConnectorConfig {
  authToken?: string;
  instanceUrl?: string;
  communityId?: number;
  httpClient?: HttpClient;
}

/**
 * Connector for Lemmy Federated Link Aggregator v3 API (https://join-lemmy.org/api/index.html).
 */
export class LemmyConnector extends BaseConnector {
  public readonly destinationKey = 'lemmy';
  public readonly name = 'Lemmy Federation';
  public readonly capabilities: ConnectorCapabilities = {
    canPublish: true,
    canVerify: true,
    canGetStatus: true,
    canDelete: true,
    supportsSimulation: true,
  };

  private authToken?: string;
  private instanceUrl: string;
  private communityId?: number;
  private httpClient: HttpClient;

  constructor(config: LemmyConnectorConfig = {}) {
    super();
    this.authToken = config.authToken || process.env.LEMMY_AUTH_TOKEN;
    this.instanceUrl = (config.instanceUrl || process.env.LEMMY_INSTANCE_URL || 'http://localhost:8536').replace(/\/+$/, '');
    this.communityId = config.communityId || (process.env.LEMMY_COMMUNITY_ID ? Number(process.env.LEMMY_COMMUNITY_ID) : undefined);
    this.httpClient = config.httpClient || new FetchHttpClient();
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    if (request.simulate === true) {
      const simulatedId = `sim-lemmy-${Date.now()}`;
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: simulatedId,
        externalUrl: `${this.instanceUrl}/simulated/${simulatedId}`,
        status: 'simulated',
        isSimulated: true,
        timestamp: this.createTimestamp(),
        metadata: { dryRun: true, ...request.metadata },
      };
    }

    if (!this.authToken) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'Lemmy auth token is not configured. Set LEMMY_AUTH_TOKEN.',
        },
      };
    }

    const communityId = (request.metadata?.communityId as number) || this.communityId;
    if (!communityId) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'Lemmy communityId is required in config or request metadata.',
        },
      };
    }

    try {
      const payload: Record<string, unknown> = {
        name: request.content.title,
        body: request.content.body,
        community_id: communityId,
        auth: this.authToken,
      };

      if (request.content.canonicalUrl) {
        payload.url = request.content.canonicalUrl;
      }

      const response = await this.httpClient.request<{
        post_view: {
          post: {
            id: number;
            name: string;
            ap_id: string;
            deleted: boolean;
          };
        };
      }>(`${this.instanceUrl}/api/v3/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      const post = response.data.post_view?.post;
      if (!post) {
        throw new Error('Lemmy API returned unexpected post response structure.');
      }

      const externalUrl = post.ap_id || `${this.instanceUrl}/post/${post.id}`;

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: String(post.id),
        externalUrl,
        status: post.deleted ? 'deleted' : 'published',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        metadata: {
          id: post.id,
          apId: post.ap_id,
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
          code: errorObj.code || 'PUBLISH_FAILED',
          message: errorObj.message || 'Lemmy post publication failed',
        },
      };
    }
  }

  public async verify(request: VerifyRequest): Promise<VerifyResult> {
    if (!this.authToken) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: { code: 'AUTH_CONFIG_MISSING', message: 'Lemmy auth token required.' },
      };
    }

    try {
      const response = await this.httpClient.request<{
        post_view: {
          post: {
            id: number;
            ap_id: string;
            deleted: boolean;
          };
        };
      }>(`${this.instanceUrl}/api/v3/post?id=${request.externalId}&auth=${encodeURIComponent(this.authToken)}`, {
        method: 'GET',
      });

      const post = response.data.post_view?.post;
      if (!post) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          externalId: request.externalId,
          verified: false,
          status: 'unknown',
          timestamp: this.createTimestamp(),
          error: { code: 'NOT_FOUND', message: 'Post not found on Lemmy.' },
        };
      }

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: String(post.id),
        verified: true,
        status: post.deleted ? 'deleted' : 'published',
        externalUrl: post.ap_id,
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
          error: { code: 'NOT_FOUND', message: `Post '${request.externalId}' not found on Lemmy.` },
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
    const verified = await this.verify({
      destinationKey: this.destinationKey,
      externalId: request.externalId,
    });

    return {
      success: verified.success,
      destinationKey: this.destinationKey,
      externalId: request.externalId,
      status: verified.status,
      timestamp: this.createTimestamp(),
      error: verified.error,
      details: verified.externalUrl ? { url: verified.externalUrl } : undefined,
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

    if (!this.authToken) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: { code: 'AUTH_CONFIG_MISSING', message: 'Lemmy auth token required for deletion.' },
      };
    }

    try {
      await this.httpClient.request(
        `${this.instanceUrl}/api/v3/post/delete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            post_id: Number(request.externalId),
            deleted: true,
            auth: this.authToken,
          },
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
}
