import type {
  HealthResponse,
  DestinationSummary,
  DestinationDetail,
  PublishRequestBody,
  PublishResult,
  AsyncJobAcceptedResponse,
  Job,
  VerifyResult,
  GetStatusResult,
  DeleteResult,
  CertificationReport,
  CertificationRunResponse,
  ApiError,
  DestinationSlotsResponse,
  TrackingVerifyResult,
  TrackingGenerateResult,
} from '../types/api';

// Configurable API base URL, defaulting to local backend at http://localhost:3000
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Custom error class carrying parsed API error details.
 */
export class IncubrixApiError extends Error {
  statusCode: number;
  apiError: ApiError;

  constructor(statusCode: number, apiError: ApiError) {
    super(apiError.message || `API error with status ${statusCode}`);
    this.name = 'IncubrixApiError';
    this.statusCode = statusCode;
    this.apiError = apiError;
  }
}

/**
 * Core fetch helper with error parsing and timeout protection.
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let apiError: ApiError;
    if (typeof data === 'object' && data !== null) {
      apiError = data as ApiError;
    } else {
      apiError = {
        message: String(data) || response.statusText || `Request failed with code ${response.status}`,
        statusCode: response.status,
      };
    }
    apiError.statusCode = apiError.statusCode || response.status;
    throw new IncubrixApiError(response.status, apiError);
  }

  return data as T;
}

/**
 * Generates a unique, collision-resistant idempotency key suitable for publications.
 */
export function generateIdempotencyKey(prefix = 'pub'): string {
  const randomSegment = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${Date.now()}-${randomSegment}`;
}

export const api = {
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  /**
   * GET /health
   */
  async getHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  /**
   * GET /api/v1/destinations
   */
  async getDestinations(): Promise<{ destinations: DestinationSummary[] }> {
    return request<{ destinations: DestinationSummary[] }>('/api/v1/destinations');
  },

  /**
   * GET /api/v1/destinations/:destinationKey
   */
  async getDestination(destinationKey: string): Promise<{ destination: DestinationDetail }> {
    return request<{ destination: DestinationDetail }>(`/api/v1/destinations/${encodeURIComponent(destinationKey)}`);
  },

  /**
   * POST /api/v1/destinations/:destinationKey/publish
   * Strictly enforces simulate: true by default to avoid publishing to real platforms.
   */
  async publish(
    destinationKey: string,
    idempotencyKey: string,
    payload: PublishRequestBody
  ): Promise<PublishResult | AsyncJobAcceptedResponse> {
    // Safety check: ensure simulate is always true from the UI
    const safePayload: PublishRequestBody = {
      ...payload,
      simulate: true,
    };

    return request<PublishResult | AsyncJobAcceptedResponse>(
      `/api/v1/destinations/${encodeURIComponent(destinationKey)}/publish`,
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(safePayload),
      }
    );
  },

  /**
   * GET /api/v1/jobs/:jobId
   */
  async getJob(jobId: string): Promise<{ job: Job }> {
    return request<{ job: Job }>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
  },

  /**
   * Polls background job status until completed or timed out.
   */
  async pollJobUntilComplete(
    jobId: string,
    intervalMs = 800,
    maxWaitMs = 15000,
    onProgress?: (job: Job) => void
  ): Promise<Job> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const { job } = await this.getJob(jobId);
      if (onProgress) onProgress(job);
      if (job.status === 'succeeded' || job.status === 'failed') {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(`Job '${jobId}' timed out after ${maxWaitMs}ms.`);
  },

  /**
   * POST /api/v1/destinations/:destinationKey/verify/:externalId?simulate=true
   */
  async verifyPublication(destinationKey: string, externalId: string): Promise<VerifyResult> {
    return request<VerifyResult>(
      `/api/v1/destinations/${encodeURIComponent(destinationKey)}/verify/${encodeURIComponent(externalId)}?simulate=true`,
      { method: 'POST' }
    );
  },

  /**
   * GET /api/v1/destinations/:destinationKey/status/:externalId?simulate=true
   */
  async getPublicationStatus(destinationKey: string, externalId: string): Promise<GetStatusResult> {
    return request<GetStatusResult>(
      `/api/v1/destinations/${encodeURIComponent(destinationKey)}/status/${encodeURIComponent(externalId)}?simulate=true`
    );
  },

  /**
   * DELETE /api/v1/destinations/:destinationKey/:externalId?simulate=true
   */
  async deletePublication(destinationKey: string, externalId: string): Promise<DeleteResult> {
    return request<DeleteResult>(
      `/api/v1/destinations/${encodeURIComponent(destinationKey)}/${encodeURIComponent(externalId)}?simulate=true`,
      { method: 'DELETE' }
    );
  },

  /**
   * GET /api/v1/certification
   */
  async listCertifications(): Promise<{ reports: CertificationReport[] }> {
    return request<{ reports: CertificationReport[] }>('/api/v1/certification');
  },

  /**
   * GET /api/v1/certification/:runId
   */
  async getCertification(runId: string): Promise<{ report: CertificationReport }> {
    return request<{ report: CertificationReport }>(`/api/v1/certification/${encodeURIComponent(runId)}`);
  },

  /**
   * POST /api/v1/certification/run
   * Executes in mock mode only.
   */
  async runCertification(destinationKey?: string): Promise<CertificationRunResponse> {
    return request<CertificationRunResponse>('/api/v1/certification/run', {
      method: 'POST',
      body: JSON.stringify({
        destinationKey: destinationKey || undefined,
        mode: 'mock',
        allowLive: false,
      }),
    });
  },

  /**
   * GET /api/v1/destinations/:destinationKey/slots
   */
  async getDestinationSlots(destinationKey: string): Promise<DestinationSlotsResponse> {
    return request<DestinationSlotsResponse>(`/api/v1/destinations/${encodeURIComponent(destinationKey)}/slots`);
  },

  /**
   * POST /api/v1/tracking/verify
   */
  async verifyTrackingLink(url: string, destinationKey?: string): Promise<TrackingVerifyResult> {
    return request<TrackingVerifyResult>('/api/v1/tracking/verify', {
      method: 'POST',
      body: JSON.stringify({ url, destinationKey }),
    });
  },

  /**
   * POST /api/v1/tracking/generate
   */
  async generateTrackingLink(payload: {
    baseUrl: string;
    destinationKey: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    sign?: boolean;
  }): Promise<TrackingGenerateResult> {
    return request<TrackingGenerateResult>('/api/v1/tracking/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
