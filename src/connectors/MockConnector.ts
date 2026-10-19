import { BaseConnector } from './BaseConnector';
import {
  ConnectorCapabilities,
  ContentPayload,
  ContentStatus,
  DeleteRequest,
  DeleteResult,
  GetStatusRequest,
  GetStatusResult,
  PublishRequest,
  PublishResult,
  VerifyRequest,
  VerifyResult,
} from './types';

export interface MockStoredItem {
  id: string;
  url: string;
  content: ContentPayload;
  status: ContentStatus;
  publishedAt: string;
  metadata?: Record<string, unknown>;
}

export interface MockConnectorOptions {
  destinationKey?: string;
  name?: string;
  baseUrl?: string;
  capabilities?: Partial<ConnectorCapabilities>;
}

/**
 * Deterministic mock connector for local development, simulation, and automated tests.
 * Performs all operations in-memory without making external network calls.
 */
export class MockConnector extends BaseConnector {
  public readonly destinationKey: string;
  public readonly name: string;
  public readonly capabilities: ConnectorCapabilities;
  private readonly baseUrl: string;

  private items = new Map<string, MockStoredItem>();
  private sequence = 1;
  private failPublish = false;
  private failVerify = false;
  private failDelete = false;

  constructor(options: MockConnectorOptions = {}) {
    super();
    this.destinationKey = options.destinationKey || 'mock';
    this.name = options.name || 'Deterministic Mock Destination';
    this.baseUrl = options.baseUrl || 'https://mock.incubrix.local';

    this.capabilities = {
      canPublish: true,
      canVerify: true,
      canGetStatus: true,
      canDelete: true,
      supportsSimulation: true,
      ...options.capabilities,
    };
  }

  public async publish(request: PublishRequest): Promise<PublishResult> {
    if (!this.capabilities.canPublish) {
      return this.createUnsupportedPublishResult();
    }

    if (!request.content) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'Content payload is required for publishing.',
        },
      };
    }

    if (!request.content.title || !request.content.title.trim()) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'Content title cannot be empty.',
        },
      };
    }

    if (!request.content.body || !request.content.body.trim()) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'Content body cannot be empty.',
        },
      };
    }

    // Deterministic failure injection for test scenarios
    if (this.failPublish) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        status: 'failed',
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'PUBLISH_FAILED',
          message: 'Mock publishing failure configured for testing.',
        },
      };
    }

    // Explicit simulation / dry-run execution
    if (request.simulate === true) {
      if (!this.capabilities.supportsSimulation) {
        return {
          success: false,
          destinationKey: this.destinationKey,
          status: 'failed',
          isSimulated: false,
          timestamp: this.createTimestamp(),
          unsupported: true,
          unsupportedReason: 'Simulation is not supported by this connector.',
          error: {
            code: 'SIMULATION_NOT_SUPPORTED',
            message: 'Simulation is not supported by this connector.',
          },
        };
      }

      const simulatedId = `sim-${this.destinationKey}-${this.sequence++}`;
      // In simulation mode, never persist or modify external state
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: simulatedId,
        externalUrl: `${this.baseUrl}/simulated/${simulatedId}`,
        status: 'simulated',
        isSimulated: true,
        timestamp: this.createTimestamp(),
        metadata: {
          dryRun: true,
          simulated: true,
          ...request.metadata,
        },
      };
    }

    const id = `${this.destinationKey}-${this.sequence++}`;
    const url = `${this.baseUrl}/posts/${id}`;

    this.items.set(id, {
      id,
      url,
      content: { ...request.content },
      status: 'published',
      publishedAt: this.createTimestamp(),
      metadata: request.metadata,
    });

    return {
      success: true,
      destinationKey: this.destinationKey,
      externalId: id,
      externalUrl: url,
      status: 'published',
      isSimulated: false,
      timestamp: this.createTimestamp(),
      metadata: request.metadata,
    };
  }

  public async verify(request: VerifyRequest): Promise<VerifyResult> {
    if (!this.capabilities.canVerify) {
      return this.createUnsupportedVerifyResult(request.externalId);
    }

    if (!request.externalId || !request.externalId.trim()) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: '',
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'externalId is required for verification.',
        },
      };
    }

    if (this.failVerify) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'failed',
        timestamp: this.createTimestamp(),
        error: {
          code: 'VERIFY_FAILED',
          message: 'Mock verification failure configured for testing.',
        },
      };
    }

    // Verification of simulated ID
    if (request.externalId.startsWith('sim-')) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: true,
        status: 'simulated',
        externalUrl: `${this.baseUrl}/simulated/${request.externalId}`,
        timestamp: this.createTimestamp(),
        details: { isSimulated: true },
      };
    }

    const item = this.items.get(request.externalId);
    if (!item) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        verified: false,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: `Content with externalId '${request.externalId}' not found.`,
        },
      };
    }

    return {
      success: true,
      destinationKey: this.destinationKey,
      externalId: item.id,
      verified: true,
      status: item.status,
      externalUrl: item.url,
      timestamp: this.createTimestamp(),
      details: {
        publishedAt: item.publishedAt,
      },
    };
  }

  public async getStatus(request: GetStatusRequest): Promise<GetStatusResult> {
    if (!this.capabilities.canGetStatus) {
      return this.createUnsupportedStatusResult(request.externalId);
    }

    if (!request.externalId || !request.externalId.trim()) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: '',
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'externalId is required for getStatus.',
        },
      };
    }

    if (request.externalId.startsWith('sim-')) {
      return {
        success: true,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        status: 'simulated',
        timestamp: this.createTimestamp(),
        details: { isSimulated: true },
      };
    }

    const item = this.items.get(request.externalId);
    if (!item) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        status: 'unknown',
        timestamp: this.createTimestamp(),
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: `Content with externalId '${request.externalId}' not found.`,
        },
      };
    }

    return {
      success: true,
      destinationKey: this.destinationKey,
      externalId: item.id,
      status: item.status,
      timestamp: this.createTimestamp(),
      details: {
        url: item.url,
        publishedAt: item.publishedAt,
      },
    };
  }

  public async delete(request: DeleteRequest): Promise<DeleteResult> {
    if (!this.capabilities.canDelete) {
      return this.createUnsupportedDeleteResult(request.externalId);
    }

    if (!request.externalId || !request.externalId.trim()) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: '',
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'INVALID_REQUEST',
          message: 'externalId is required for deletion.',
        },
      };
    }

    if (this.failDelete) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'DELETE_FAILED',
          message: 'Mock deletion failure configured for testing.',
        },
      };
    }

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

    const exists = this.items.has(request.externalId);
    if (!exists) {
      return {
        success: false,
        destinationKey: this.destinationKey,
        externalId: request.externalId,
        deleted: false,
        isSimulated: false,
        timestamp: this.createTimestamp(),
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: `Cannot delete: content with externalId '${request.externalId}' not found.`,
        },
      };
    }

    this.items.delete(request.externalId);

    return {
      success: true,
      destinationKey: this.destinationKey,
      externalId: request.externalId,
      deleted: true,
      isSimulated: false,
      timestamp: this.createTimestamp(),
    };
  }

  // Testing inspection and configuration helpers
  public reset(): void {
    this.items.clear();
    this.sequence = 1;
    this.failPublish = false;
    this.failVerify = false;
    this.failDelete = false;
  }

  public getItem(id: string): MockStoredItem | undefined {
    return this.items.get(id);
  }

  public getAllItems(): MockStoredItem[] {
    return Array.from(this.items.values());
  }

  public setFailPublish(fail: boolean): void {
    this.failPublish = fail;
  }

  public setFailVerify(fail: boolean): void {
    this.failVerify = fail;
  }

  public setFailDelete(fail: boolean): void {
    this.failDelete = fail;
  }

  public setItemStatus(id: string, status: ContentStatus): void {
    const item = this.items.get(id);
    if (item) {
      item.status = status;
    }
  }
}
