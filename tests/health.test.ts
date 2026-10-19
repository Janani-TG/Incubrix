import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('GET /health', () => {
  it('should return 200 and a healthy JSON status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
    expect(response.body).toHaveProperty('environment');
  });
});
