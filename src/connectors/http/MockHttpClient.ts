import { HttpClient, HttpError, HttpRequestOptions, HttpResponse } from './types';

export interface RecordedRequest {
  url: string;
  options: HttpRequestOptions;
}

export type MockHandler = (
  url: string,
  options: HttpRequestOptions
) => Promise<HttpResponse<any>> | HttpResponse<any>;

/**
 * Mock HTTP client for deterministic unit testing without external network traffic.
 */
export class MockHttpClient implements HttpClient {
  public recordedRequests: RecordedRequest[] = [];
  private queuedResponses: HttpResponse<any>[] = [];
  private handlers = new Map<string, MockHandler>();
  private defaultHandler?: MockHandler;

  public queueResponse(response: HttpResponse<any>): void {
    this.queuedResponses.push(response);
  }

  public registerHandler(pattern: string, handler: MockHandler): void {
    this.handlers.set(pattern, handler);
  }

  public setDefaultHandler(handler: MockHandler): void {
    this.defaultHandler = handler;
  }

  public async request<T = unknown>(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    this.recordedRequests.push({ url, options });

    // 1. Check queued responses
    if (this.queuedResponses.length > 0) {
      const resp = this.queuedResponses.shift()!;
      if (resp.status >= 400) {
        throw new HttpError(resp.status, resp.statusText, url, resp.data);
      }
      return resp as HttpResponse<T>;
    }

    // 2. Check pattern handlers
    for (const [pattern, handler] of this.handlers.entries()) {
      if (url.includes(pattern)) {
        const resp = await handler(url, options);
        if (resp.status >= 400) {
          throw new HttpError(resp.status, resp.statusText, url, resp.data);
        }
        return resp as HttpResponse<T>;
      }
    }

    // 3. Check default handler
    if (this.defaultHandler) {
      const resp = await this.defaultHandler(url, options);
      if (resp.status >= 400) {
        throw new HttpError(resp.status, resp.statusText, url, resp.data);
      }
      return resp as HttpResponse<T>;
    }

    // Fallback: return 200 OK with empty object
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: {} as T,
    };
  }

  public reset(): void {
    this.recordedRequests = [];
    this.queuedResponses = [];
    this.handlers.clear();
    this.defaultHandler = undefined;
  }
}
