import {
  Connector,
  ConnectorCapabilities,
  DeleteRequest,
  DeleteResult,
  GetStatusRequest,
  GetStatusResult,
  PublishRequest,
  PublishResult,
  VerifyRequest,
  VerifyResult,
} from './types';

/**
 * Base abstract class providing common behavior and explicit unsupported capability responses.
 */
export abstract class BaseConnector implements Connector {
  abstract readonly destinationKey: string;
  abstract readonly name: string;
  abstract readonly capabilities: ConnectorCapabilities;

  protected createTimestamp(): string {
    return new Date().toISOString();
  }

  protected createUnsupportedPublishResult(reason?: string): PublishResult {
    const msg =
      reason || `Publishing is not supported by connector '${this.destinationKey}'.`;
    return {
      success: false,
      destinationKey: this.destinationKey,
      status: 'failed',
      isSimulated: false,
      timestamp: this.createTimestamp(),
      unsupported: true,
      unsupportedReason: msg,
      error: {
        code: 'UNSUPPORTED_CAPABILITY',
        message: msg,
      },
    };
  }

  protected createUnsupportedVerifyResult(
    externalId: string,
    reason?: string
  ): VerifyResult {
    const msg =
      reason || `Verification is not supported by connector '${this.destinationKey}'.`;
    return {
      success: false,
      destinationKey: this.destinationKey,
      externalId,
      verified: false,
      status: 'unknown',
      timestamp: this.createTimestamp(),
      unsupported: true,
      unsupportedReason: msg,
      error: {
        code: 'UNSUPPORTED_CAPABILITY',
        message: msg,
      },
    };
  }

  protected createUnsupportedStatusResult(
    externalId: string,
    reason?: string
  ): GetStatusResult {
    const msg =
      reason ||
      `Status checking is not supported by connector '${this.destinationKey}'.`;
    return {
      success: false,
      destinationKey: this.destinationKey,
      externalId,
      status: 'unknown',
      timestamp: this.createTimestamp(),
      unsupported: true,
      unsupportedReason: msg,
      error: {
        code: 'UNSUPPORTED_CAPABILITY',
        message: msg,
      },
    };
  }

  protected createUnsupportedDeleteResult(
    externalId: string,
    reason?: string
  ): DeleteResult {
    const msg =
      reason || `Deletion is not supported by connector '${this.destinationKey}'.`;
    return {
      success: false,
      destinationKey: this.destinationKey,
      externalId,
      deleted: false,
      isSimulated: false,
      timestamp: this.createTimestamp(),
      unsupported: true,
      unsupportedReason: msg,
      error: {
        code: 'UNSUPPORTED_CAPABILITY',
        message: msg,
      },
    };
  }

  abstract publish(request: PublishRequest): Promise<PublishResult>;
  abstract verify(request: VerifyRequest): Promise<VerifyResult>;
  abstract getStatus(request: GetStatusRequest): Promise<GetStatusResult>;
  abstract delete(request: DeleteRequest): Promise<DeleteResult>;
}
