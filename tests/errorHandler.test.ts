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
});
