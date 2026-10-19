import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { runCliCertification } from '../../src/cli/certify';

describe('CLI Certification Runner (certify.ts)', () => {
  const testOutDir = path.resolve(process.cwd(), 'scratch/cli_test_output');

  beforeEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  it('should run certification in mock mode and produce JSON report with exit code 0', async () => {
    const exitCode = await runCliCertification([
      '--destination',
      'mock',
      '--out',
      'scratch/cli_test_output',
    ]);

    expect(exitCode).toBe(0);
    expect(fs.existsSync(testOutDir)).toBe(true);

    const files = fs.readdirSync(testOutDir);
    expect(files.length).toBeGreaterThan(0);

    const reportFile = path.join(testOutDir, files[0]!);
    const content = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    expect(Array.isArray(content)).toBe(true);
    expect(content[0].destinationKey).toBe('mock');
    expect(content[0].isCertified).toBe(true);
  });

  it('should run certification across all registered destinations in mock mode with exit code 0', async () => {
    const exitCode = await runCliCertification([
      '--out',
      'scratch/cli_test_output',
    ]);

    expect(exitCode).toBe(0);
    const files = fs.readdirSync(testOutDir);
    expect(files.length).toBeGreaterThan(0);

    const reportFile = path.join(testOutDir, files[files.length - 1]!);
    const reports = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBe(7);
    expect(reports.every((r: any) => r.isCertified)).toBe(true);
  });

  it('should reject path traversal in output directory flag with exit code 1', async () => {
    const exitCode = await runCliCertification([
      '--out',
      '../outside-project-root',
    ]);

    expect(exitCode).toBe(1);
  });
});
