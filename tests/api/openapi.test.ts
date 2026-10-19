import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

describe('OpenAPI 3.1 Specification Validation', () => {
  const openApiPath = path.resolve(process.cwd(), 'openapi.yaml');

  it('should exist and parse as valid YAML without errors', () => {
    expect(fs.existsSync(openApiPath)).toBe(true);
    const rawYaml = fs.readFileSync(openApiPath, 'utf8');

    const doc = YAML.parse(rawYaml);
    expect(doc).toBeDefined();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toContain('IncuBrix');
    expect(doc.paths).toBeDefined();
    expect(doc.components).toBeDefined();
  });

  it('should document all implemented /api/v1/ endpoints', () => {
    const rawYaml = fs.readFileSync(openApiPath, 'utf8');
    const doc = YAML.parse(rawYaml);

    const expectedPaths = [
      '/health',
      '/api/v1/destinations',
      '/api/v1/destinations/{destinationKey}',
      '/api/v1/destinations/{destinationKey}/publish',
      '/api/v1/destinations/{destinationKey}/verify/{externalId}',
      '/api/v1/destinations/{destinationKey}/status/{externalId}',
      '/api/v1/destinations/{destinationKey}/{externalId}',
      '/api/v1/jobs/{jobId}',
      '/api/v1/certification/run',
      '/api/v1/certification',
      '/api/v1/certification/{runId}',
    ];

    for (const p of expectedPaths) {
      expect(doc.paths[p]).toBeDefined();
    }
  });

  it('should document Idempotency-Key header requirement on publish endpoint', () => {
    const rawYaml = fs.readFileSync(openApiPath, 'utf8');
    const doc = YAML.parse(rawYaml);

    const publishOp = doc.paths['/api/v1/destinations/{destinationKey}/publish'].post;
    expect(publishOp).toBeDefined();

    const headers = publishOp.parameters.filter((p: any) => p.in === 'header');
    const idempHeader = headers.find((h: any) => h.name === 'Idempotency-Key');

    expect(idempHeader).toBeDefined();
    expect(idempHeader.required).toBe(true);
  });

  it('should document expected HTTP status codes including 202, 409, 422, and 501', () => {
    const rawYaml = fs.readFileSync(openApiPath, 'utf8');
    const doc = YAML.parse(rawYaml);

    const publishResponses = doc.paths['/api/v1/destinations/{destinationKey}/publish'].post.responses;
    expect(publishResponses['200']).toBeDefined();
    expect(publishResponses['201']).toBeDefined();
    expect(publishResponses['202']).toBeDefined(); // Asynchronous offload
    expect(publishResponses['400']).toBeDefined(); // Validation
    expect(publishResponses['409']).toBeDefined(); // Idempotency conflict
    expect(publishResponses['422']).toBeDefined(); // Posting rule violation

    const verifyResponses = doc.paths['/api/v1/destinations/{destinationKey}/verify/{externalId}'].post.responses;
    expect(verifyResponses['501']).toBeDefined(); // Unsupported capability
  });
});
