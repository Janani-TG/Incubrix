import { AppError } from '../../errors/AppError';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

export interface HttpClient {
  request<T = unknown>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
}

/**
 * Standard HTTP error raised on non-2xx responses.
 */
export class HttpError extends AppError {
  public readonly code: string;
  public readonly url: string;
  public readonly responseBody?: unknown;

  constructor(
    statusCode: number,
    statusText: string,
    url: string,
    responseBody?: unknown
  ) {
    super(`HTTP request failed with status ${statusCode} (${statusText})`, statusCode);
    this.name = 'HttpError';
    this.url = url;
    this.responseBody = responseBody;

    if (statusCode === 429) {
      this.code = 'RATE_LIMITED';
    } else if (statusCode >= 502 && statusCode <= 504) {
      this.code = 'GATEWAY_ERROR';
    } else if (statusCode >= 500) {
      this.code = 'SERVER_ERROR';
    } else if (statusCode === 404) {
      this.code = 'NOT_FOUND';
    } else if (statusCode === 401 || statusCode === 403) {
      this.code = 'AUTH_ERROR';
    } else {
      this.code = 'HTTP_ERROR';
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
