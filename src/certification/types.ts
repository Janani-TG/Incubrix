export type CheckStatus = 'passed' | 'failed' | 'skipped' | 'unverified';

export interface CertificationCheck {
  name: string;
  status: CheckStatus;
  durationMs: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface CertificationReportSummary {
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
  summary: CertificationReportSummary;
  checks: CertificationCheck[];
  isCertified: boolean;
  liveOptIn: boolean;
}

export interface CertificationOptions {
  destinationKey?: string;
  mode?: 'mock' | 'live';
  allowLive?: boolean;
}
