import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Unknown Routes (404 Handling)', () => {
  it('should return a JSON 404 response for non-existent GET route', async () => {
    const response = await request(app).get('/unknown-endpoint-xyz');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual({
      error: 'Not Found',
      message: 'Cannot GET /unknown-endpoint-xyz',
      statusCode: 404,
    });
  });

  it('should return a JSON 404 response for non-existent POST route', async () => {
    const response = await request(app).post('/api/v1/non-existent-resource');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual({
      error: 'Not Found',
      message: 'Cannot POST /api/v1/non-existent-resource',
      statusCode: 404,
    });
  });
});
