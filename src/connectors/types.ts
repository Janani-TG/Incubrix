/**
 * Content payload to be distributed across destination networks.
 */
export interface ContentPayload {
  title: string;
  body: string;
  summary?: string;
  tags?: string[];
  canonicalUrl?: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Lifecycle status of content on a destination platform.
 */
export type ContentStatus =
  | 'draft'
  | 'pending'
  | 'published'
  | 'simulated'
  | 'failed'
  | 'deleted'
  | 'unknown';

/**
 * Declared capabilities of a destination connector.
 */
export interface ConnectorCapabilities {
  canPublish: boolean;
  canVerify: boolean;
  canGetStatus: boolean;
  canDelete: boolean;
  supportsSimulation: boolean;
}

/**
 * Destination configuration and runtime options.
 */
export interface DestinationConfig {
  destinationKey: string;
  name: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

/**
 * Request to publish content to a destination.
 */
export interface PublishRequest {
  destinationKey: string;
  content: ContentPayload;
  simulate?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Structured result of a publish operation.
 */
export interface PublishResult {
  success: boolean;
  destinationKey: string;
  externalId?: string;
  externalUrl?: string;
  status: ContentStatus;
  isSimulated: boolean;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
  error?: ConnectorErrorDetail;
  metadata?: Record<string, unknown>;
}

/**
 * Request to verify published content on a destination.
 */
export interface VerifyRequest {
  destinationKey: string;
  externalId: string;
  expectedContentHash?: string;
  externalUrl?: string;
}

/**
 * Structured result of a verification operation.
 */
export interface VerifyResult {
  success: boolean;
  destinationKey: string;
  externalId: string;
  verified: boolean;
  status: ContentStatus;
  externalUrl?: string;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
  error?: ConnectorErrorDetail;
  details?: Record<string, unknown>;
}

/**
 * Request to check current status of published content.
 */
export interface GetStatusRequest {
  destinationKey: string;
  externalId: string;
}

/**
 * Structured result of a status query.
 */
export interface GetStatusResult {
  success: boolean;
  destinationKey: string;
  externalId: string;
  status: ContentStatus;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
  error?: ConnectorErrorDetail;
  details?: Record<string, unknown>;
}

/**
 * Request to delete content from a destination.
 */
export interface DeleteRequest {
  destinationKey: string;
  externalId: string;
  simulate?: boolean;
}

/**
 * Structured result of a deletion operation.
 */
export interface DeleteResult {
  success: boolean;
  destinationKey: string;
  externalId: string;
  deleted: boolean;
  isSimulated: boolean;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
  error?: ConnectorErrorDetail;
}

/**
 * Structured error details embedded in results.
 */
export interface ConnectorErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Primary interface for destination network connectors.
 */
export interface Connector {
  readonly destinationKey: string;
  readonly name: string;
  readonly capabilities: ConnectorCapabilities;

  publish(request: PublishRequest): Promise<PublishResult>;
  verify(request: VerifyRequest): Promise<VerifyResult>;
  getStatus(request: GetStatusRequest): Promise<GetStatusResult>;
  delete(request: DeleteRequest): Promise<DeleteResult>;
}
