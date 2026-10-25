export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
}

export interface ConnectorCapabilities {
  canPublish: boolean;
  canVerify: boolean;
  canGetStatus: boolean;
  canDelete: boolean;
  supportsSimulation: boolean;
}

export interface DestinationSummary {
  destinationKey: string;
  name: string;
  capabilities: ConnectorCapabilities;
  rulesConfigured: boolean;
}

export interface DestinationDetail {
  destinationKey: string;
  name: string;
  capabilities: ConnectorCapabilities;
  rules: Record<string, unknown> | null;
}

export interface ContentPayload {
  title: string;
  body: string;
  summary?: string;
  tags?: string[];
  canonicalUrl?: string;
  mediaUrls?: string[];
  metadata?: Record<string, unknown>;
}

export interface PublishRequestBody {
  content: ContentPayload;
  simulate?: boolean;
  async?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RuleViolation {
  ruleId: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  decision: 'allowed' | 'blocked';
  destinationKey: string;
  externalId?: string;
  externalUrl?: string;
  status: 'draft' | 'pending' | 'published' | 'simulated' | 'failed' | 'deleted' | 'unknown' | string;
  isSimulated?: boolean;
  isCached?: boolean;
  timestamp: string;
  error?: {
    code?: string;
    message: string;
  };
  evaluation?: {
    allowed: boolean;
    violations: RuleViolation[];
  };
}

export interface AsyncJobAcceptedResponse {
  status: 'queued';
  jobId: string;
  destinationKey: string;
  message: string;
  checkStatusUrl: string;
}

export interface Job {
  id: string;
  type: string;
  destinationKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  attempts: number;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  executionDurationMs?: number | null;
  result?: PublishResult | null;
  error?: {
    message?: string;
    code?: string;
  } | null;
}

export interface VerifyResult {
  success: boolean;
  destinationKey: string;
  externalId: string;
  verified: boolean;
  status?: string;
  externalUrl?: string;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
}

export interface GetStatusResult {
  success: boolean;
  destinationKey: string;
  externalId: string;
  status?: string;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
}

export interface DeleteResult {
  success: boolean;
  destinationKey: string;
  externalId: string;
  deleted: boolean;
  isSimulated?: boolean;
  timestamp: string;
  unsupported?: boolean;
  unsupportedReason?: string;
}

export type CheckStatus = 'passed' | 'failed' | 'skipped' | 'unverified';

export interface CertificationCheck {
  name: string;
  status: CheckStatus;
  durationMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface CertificationSummary {
  passed: number;
  failed: number;
  skipped: number;
  unverified: number;
}

export interface CertificationReport {
  runId: string;
  destinationKey: string;
  connectorName: string;
  environment: 'mock' | 'live';
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  summary: CertificationSummary;
  checks: CertificationCheck[];
  isCertified: boolean;
  liveOptIn: boolean;
}

export interface CertificationRunResponse {
  overallSuccess: boolean;
  count: number;
  reports: CertificationReport[];
}

export interface ApiError {
  error?: string;
  message: string;
  statusCode?: number;
  violations?: RuleViolation[];
  decision?: string;
  unsupported?: boolean;
}

export interface PublicationHistoryItem {
  id: string;
  idempotencyKey: string;
  destinationKey: string;
  title: string;
  bodySnippet: string;
  submittedAt: string;
  status: 'success' | 'blocked' | 'error' | 'queued';
  statusCode?: number;
  isCached?: boolean;
  isSimulated: boolean;
  externalId?: string;
  externalUrl?: string;
  result?: PublishResult;
  error?: ApiError;
  jobId?: string;
}
