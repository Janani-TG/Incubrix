import { AppError } from '../errors/AppError';
import { ConnectorErrorDetail } from './types';

export type ConnectorErrorCode =
  | 'CONNECTOR_NOT_FOUND'
  | 'DUPLICATE_CONNECTOR'
  | 'UNSUPPORTED_CAPABILITY'
  | 'INVALID_REQUEST'
  | 'PUBLISH_FAILED'
  | 'VERIFY_FAILED'
  | 'STATUS_FAILED'
  | 'DELETE_FAILED'
  | 'SIMULATION_NOT_SUPPORTED';

/**
 * Structured error class for connector operations and registry errors.
 */
export class ConnectorError extends AppError {
  public readonly code: ConnectorErrorCode;
  public readonly destinationKey?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ConnectorErrorCode,
    statusCode = 500,
    destinationKey?: string,
    details?: Record<string, unknown>
  ) {
    super(message, statusCode);
    this.name = 'ConnectorError';
    this.code = code;
    this.destinationKey = destinationKey;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toDetail(): ConnectorErrorDetail {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }

  public static notFound(destinationKey: string): ConnectorError {
    return new ConnectorError(
      `Connector for destination '${destinationKey}' not found.`,
      'CONNECTOR_NOT_FOUND',
      404,
      destinationKey
    );
  }

  public static duplicate(destinationKey: string): ConnectorError {
    return new ConnectorError(
      `Connector with destinationKey '${destinationKey}' is already registered.`,
      'DUPLICATE_CONNECTOR',
      409,
      destinationKey
    );
  }

  public static unsupported(
    capability: string,
    destinationKey: string
  ): ConnectorError {
    return new ConnectorError(
      `Capability '${capability}' is not supported by connector '${destinationKey}'.`,
      'UNSUPPORTED_CAPABILITY',
      501,
      destinationKey
    );
  }

  public static invalidRequest(
    message: string,
    destinationKey?: string,
    details?: Record<string, unknown>
  ): ConnectorError {
    return new ConnectorError(
      message,
      'INVALID_REQUEST',
      400,
      destinationKey,
      details
    );
  }
}
