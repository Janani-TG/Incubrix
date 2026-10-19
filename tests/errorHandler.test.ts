import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/middleware/errorHandler';
import { AppError } from '../src/errors/AppError';

describe('Centralized Error Handling Middleware', () => {
  it('should handle AppError with custom status code and message', async () => {
    const testApp = express();
    testApp.get('/test-error', () => {
      throw new AppError('Custom client error', 400);
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-error');
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toHaveProperty('error', 'Error');
    expect(response.body).toHaveProperty('message', 'Custom client error');
    expect(response.body).toHaveProperty('statusCode', 400);
  });

  it('should handle unhandled Error with 500 status code', async () => {
    const testApp = express();
    testApp.get('/test-500', () => {
      throw new Error('Unexpected crash');
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-500');
    expect(response.status).toBe(500);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toHaveProperty('error', 'Error');
    expect(response.body).toHaveProperty('message', 'Unexpected crash');
    expect(response.body).toHaveProperty('statusCode', 500);
  });

  it('should return HTTP 400 ValidationError with clean message and no stack trace for malformed JSON request body', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.post('/test-json', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandler);

    const response = await request(testApp)
      .post('/test-json')
      .set('Content-Type', 'application/json')
      .send('{"title": "Broken Json", ');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual({
      error: 'ValidationError',
      message: 'Malformed JSON payload in request body.',
      statusCode: 400,
    });
    expect(response.body.stack).toBeUndefined();
  });

  it('should reject malformed JSON on actual API route with 400 and no stack trace or leaked details', async () => {
    const { app } = await import('../src/app');

    const response = await request(app)
      .post('/api/v1/destinations/mock/publish')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', 'test-malformed-json-key')
      .send('{"content": { invalid_json ');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual({
      error: 'ValidationError',
      message: 'Malformed JSON payload in request body.',
      statusCode: 400,
    });
    expect(response.body.stack).toBeUndefined();
  });

  it('should sanitize 500 responses and omit stack traces in production mode without leaking environment changes', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const testApp = express();
      testApp.get('/test-crash', () => {
        throw new Error('Database password leak: postgres://user:secret123@localhost:5432/db in C:\\Secrets\\file.env');
      });
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-crash');

      expect(response.status).toBe(500);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
        statusCode: 500,
      });
      expect(response.body.stack).toBeUndefined();
      expect(response.text).not.toContain('secret123');
      expect(response.text).not.toContain('C:\\Secrets');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should not trust arbitrary status properties on non-AppError and map to HTTP 500', async () => {
    const testApp = express();
    testApp.get('/test-arbitrary-status', () => {
      const sneakyError = new Error('Suspicious error');
      (sneakyError as any).status = 200;
      (sneakyError as any).statusCode = 200;
      throw sneakyError;
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-arbitrary-status');
    expect(response.status).toBe(500);
    expect(response.body.statusCode).toBe(500);
  });

  it('should sanitize invalid statusCode on AppError to 500', async () => {
    const testApp = express();
    testApp.get('/test-invalid-app-error', () => {
      throw new AppError('Invalid code', 999);
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-invalid-app-error');
    expect(response.status).toBe(500);
    expect(response.body.statusCode).toBe(500);
  });

  it('should sanitize AppError with status 500 and sensitive message in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const testApp = express();
      testApp.get('/test-app-error-500', () => {
        throw new AppError('Internal DB failure at D:\\Projects\\Incubrix\\data.db with user credentials', 500);
      });
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-app-error-500');

      expect(response.status).toBe(500);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
        statusCode: 500,
      });
      expect(response.body.stack).toBeUndefined();
      expect(response.text).not.toContain('data.db');
      expect(response.text).not.toContain('credentials');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should sanitize AppError with invalid status code fallback to 500 in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const testApp = express();
      testApp.get('/test-app-error-invalid-code', () => {
        throw new AppError('Sensitive error with invalid status code', 999);
      });
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-app-error-invalid-code');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'InternalServerError',
        message: 'Internal Server Error',
        statusCode: 500,
      });
      expect(response.body.stack).toBeUndefined();
      expect(response.text).not.toContain('Sensitive error');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should preserve 4xx AppError message and status code in production mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      const testApp = express();
      testApp.get('/test-app-error-400', () => {
        throw new AppError('Valid client error message', 400);
      });
      testApp.use(errorHandler);

      const response = await request(testApp).get('/test-app-error-400');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Error',
        message: 'Valid client error message',
        statusCode: 400,
      });
      expect(response.body.stack).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
