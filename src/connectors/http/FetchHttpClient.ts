import { HttpClient, HttpError, HttpRequestOptions, HttpResponse } from './types';

/**
 * Production HTTP client using native Node.js fetch with request timeouts and error handling.
 */
export class FetchHttpClient implements HttpClient {
  constructor(private defaultTimeoutMs = 10000) {}

  public async request<T = unknown>(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    let bodyStr: string | undefined;
    if (options.body !== undefined) {
      if (typeof options.body === 'string') {
        bodyStr = options.body;
      } else {
        bodyStr = JSON.stringify(options.body);
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: bodyStr,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = text as unknown as T;
        }
      }

      if (!response.ok) {
        throw new HttpError(response.status, response.statusText, url, data);
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
      };
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        throw err;
      }
      if ((err as Error)?.name === 'AbortError') {
        const timeoutErr = new Error(`Request to '${url}' timed out after ${timeoutMs}ms.`);
        (timeoutErr as any).code = 'NETWORK_TIMEOUT';
        (timeoutErr as any).statusCode = 504;
        (timeoutErr as any).isTransient = true;
        throw timeoutErr;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
