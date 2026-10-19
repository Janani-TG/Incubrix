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

export interface DiscourseConnectorConfig {
  apiKey?: string;
  apiUsername?: string;
  baseUrl?: string;
  categoryId?: number;
  httpClient?: HttpClient;
}

/**
 * Connector for Discourse Forum API (https://docs.discourse.org/).
 */
export class DiscourseConnector extends BaseConnector {
  public readonly destinationKey = 'discourse';
  public readonly name = 'Discourse Community';
  public readonly capabilities: ConnectorCapabilities = {
    canPublish: true,
    canVerify: true,
    canGetStatus: true,
    canDelete: true,
    supportsSimulation: true,
  };

  private apiKey?: string;
  private apiUsername: string;
  private baseUrl: string;
  private categoryId?: number;
  private httpClient: HttpClient;

  constructor(config: DiscourseConnectorConfig = {}) {
    super();
    this.apiKey = config.apiKey || process.env.DISCOURSE_API_KEY;
    this.apiUsername = config.apiUsername || process.env.DISCOURSE_API_USERNAME || 'system';
    this.baseUrl = (config.baseUrl || process.env.DISCOURSE_BASE_URL || 'http://localhost:4200').replace(/\/+$/, '');
    this.categoryId = config.categoryId;
    this.httpClient = config.httpClient || new FetchHttpClient();
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('Discourse API key is not configured.');
    }
    return {
      'Api-Key': this.apiKey,
      'Api-Username': this.apiUsername,
      'Content-Type': 'application/json',
    };
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    if (request.simulate === true) {
      const simulatedId = `sim-discourse-${Date.now()}`;
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: simulatedId,
        externalUrl: `${this.baseUrl}/simulated/${simulatedId}`,
        status: 'simulated',
        isSimulated: true,
        timestamp: this.createTimestamp(),
        metadata: { dryRun: true, ...request.metadata },
      };
    }

    if (!this.apiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'Discourse Api-Key is not configured. Set DISCOURSE_API_KEY.',
        },
      };
    }

    try {
      const payload: Record<string, unknown> = {
        title: request.content.title,
        raw: request.content.body,
      };

      const category = (request.metadata?.categoryId as number) || this.categoryId;
      if (category !== undefined) {
        payload.category = category;
      }

      const response = await this.httpClient.request<{
        id: number;
        post_number: number;
        topic_id: number;
        topic_slug: string;
      }>(`${this.baseUrl}/posts.json`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: payload,
      });

      const { id, post_number, topic_id, topic_slug } = response.data;
      const externalUrl = `${this.baseUrl}/t/${topic_slug}/${topic_id}/${post_number}`;

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: String(id),
        externalUrl,
        status: 'published',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        metadata: {
          postId: id,
          topicId: topic_id,
          postNumber: post_number,
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
          message: errorObj.message || 'Discourse post creation failed',
        },
      };
    }
  }

  public async verify(request: VerifyRequest): Promise<VerifyResult> {
    if (!this.apiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: { code: 'AUTH_CONFIG_MISSING', message: 'Discourse Api-Key required.' },
      };
    }

    try {
      const response = await this.httpClient.request<{
        id: number;
        post_number: number;
        topic_id: number;
        topic_slug: string;
      }>(`${this.baseUrl}/posts/${request.externalId}.json`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const { id, post_number, topic_id, topic_slug } = response.data;
      const externalUrl = `${this.baseUrl}/t/${topic_slug}/${topic_id}/${post_number}`;

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: String(id),
        verified: true,
        status: 'published',
        externalUrl,
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
          error: { code: 'NOT_FOUND', message: `Post '${request.externalId}' not found on Discourse.` },
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

    if (!this.apiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: { code: 'AUTH_CONFIG_MISSING', message: 'Discourse Api-Key required for deletion.' },
      };
    }

    try {
      await this.httpClient.request(
        `${this.baseUrl}/posts/${request.externalId}.json`,
        {
          method: 'DELETE',
          headers: this.getHeaders(),
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
