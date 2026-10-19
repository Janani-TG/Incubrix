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

export interface DevtoConnectorConfig {
  apiKey?: string;
  baseUrl?: string;
  httpClient?: HttpClient;
}

/**
 * Connector for Dev.to / Forem API (https://developers.forem.com/api/v0).
 */
export class DevtoConnector extends BaseConnector {
  public readonly destinationKey = 'devto';
  public readonly name = 'DEV.to Community';
  public readonly capabilities: ConnectorCapabilities = {
    canPublish: true,
    canVerify: true,
    canGetStatus: true,
    canDelete: true,
    supportsSimulation: true,
  };

  private apiKey?: string;
  private baseUrl: string;
  private httpClient: HttpClient;

  constructor(config: DevtoConnectorConfig = {}) {
    super();
    this.apiKey = config.apiKey || process.env.DEVTO_API_KEY;
    this.baseUrl = (config.baseUrl || process.env.DEVTO_BASE_URL || 'https://dev.to/api').replace(/\/+$/, '');
    this.httpClient = config.httpClient || new FetchHttpClient();
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    if (request.simulate === true) {
      const simulatedId = `sim-devto-${Date.now()}`;
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
          message: 'DEV.to API key is not configured. Set DEVTO_API_KEY.',
        },
      };
    }

    try {
      const payload = {
        article: {
          title: request.content.title,
          body_markdown: request.content.body,
          description: request.content.summary,
          tags: request.content.tags?.slice(0, 4) || [], // Dev.to allows max 4 tags
          canonical_url: request.content.canonicalUrl,
          published: true,
        },
      };

      const response = await this.httpClient.request<{ id: number; url: string; published: boolean }>(
        `${this.baseUrl}/articles`,
        {
          method: 'POST',
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: payload,
        }
      );

      const externalId = String(response.data.id);
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId,
        externalUrl: response.data.url,
        status: 'published',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        metadata: {
          id: response.data.id,
          url: response.data.url,
        },
      };
    } catch (err: unknown) {
      return this.handleHttpError(err, 'publish');
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
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'DEV.to API key required for verification.',
        },
      };
    }

    try {
      const response = await this.httpClient.request<{ id: number; url: string; published: boolean }>(
        `${this.baseUrl}/articles/${request.externalId}`,
        {
          method: 'GET',
          headers: { 'api-key': this.apiKey },
        }
      );

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: String(response.data.id),
        verified: true,
        status: response.data.published ? 'published' : 'draft',
        externalUrl: response.data.url,
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
          error: { code: 'NOT_FOUND', message: `Article '${request.externalId}' not found on DEV.to.` },
        };
      }
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: (err as any).code || 'VERIFICATION_FAILED',
          message: (err as Error).message,
        },
      };
    }
  }

  public async getStatus(request: GetStatusRequest): Promise<GetStatusResult> {
    if (!this.apiKey) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'DEV.to API key required for status check.',
        },
      };
    }

    try {
      const response = await this.httpClient.request<{ id: number; url: string; published: boolean }>(
        `${this.baseUrl}/articles/${request.externalId}`,
        {
          method: 'GET',
          headers: { 'api-key': this.apiKey },
        }
      );

      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: String(response.data.id),
        status: response.data.published ? 'published' : 'draft',
        timestamp: this.createTimestamp(),
        details: { url: response.data.url },
      };
    } catch (err: unknown) {
      if (err instanceof HttpError && err.statusCode === 404) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          externalId: request.externalId,
          status: 'unknown',
          timestamp: this.createTimestamp(),
          error: { code: 'NOT_FOUND', message: 'Article not found.' },
        };
      }
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: (err as any).code || 'STATUS_QUERY_FAILED',
          message: (err as Error).message,
        },
      };
    }
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
        error: {
          code: 'AUTH_CONFIG_MISSING',
          message: 'DEV.to API key required for deletion.',
        },
      };
    }

    try {
      await this.httpClient.request(
        `${this.baseUrl}/articles/${request.externalId}`,
        {
          method: 'DELETE',
          headers: { 'api-key': this.apiKey },
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
        error: {
          code: (err as any).code || 'DELETE_FAILED',
          message: (err as Error).message,
        },
      };
    }
  }

  private handleHttpError(err: unknown, operation: string): PublishResult {
    const errorObj = err as any;
    const code = errorObj.code || 'PUBLISH_FAILED';
    const message = errorObj.message || `DEV.to ${operation} failed`;

    return {
      success: false,
      destinationKey: this.destinationKey,
      status: 'failed',
      isSimulated: false,
      timestamp: this.createTimestamp(),
      error: {
        code,
        message,
        details: errorObj.responseBody ? { responseBody: errorObj.responseBody } : undefined,
      },
    };
  }
}
