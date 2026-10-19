import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { AssistedConnector } from '../../src/connectors/implementations/AssistedConnector';
import { ContentPayload } from '../../src/connectors/types';

describe('AssistedConnector (Manual Publishing Packager)', () => {
  const testOutputDir = path.resolve(__dirname, '../../scratch/test_assisted_packs');
  let connector: AssistedConnector;

  const content: ContentPayload = {
    title: 'LinkedIn Thought Leadership Article',
    body: '# Scaling Long-Tail Distribution Networks\nKey insights into modular connector architecture.',
    summary: 'Executive summary for manual LinkedIn submission.',
    tags: ['engineering', 'leadership'],
    canonicalUrl: 'https://incubrix.io/blog/scaling-distribution',
  };

  beforeEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });

    connector = new AssistedConnector({
      destinationKey: 'assisted-linkedin',
      outputDirectory: testOutputDir,
    });
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('Pack Generation', () => {
    it('should generate ready-to-post pack on disk with draft status', async () => {
      const result = await connector.publish({
        destinationKey: 'assisted-linkedin',
        content,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('draft'); // Never reports 'published'!
      expect(result.isSimulated).toBe(false);
      expect(result.externalId).toBeDefined();

      const packDir = path.join(testOutputDir, result.externalId!);
      expect(fs.existsSync(packDir)).toBe(true);

      // Verify files generated
      const manifestFile = path.join(packDir, 'manifest.json');
      const contentFile = path.join(packDir, 'content.md');
      const instructionsFile = path.join(packDir, 'instructions.txt');

      expect(fs.existsSync(manifestFile)).toBe(true);
      expect(fs.existsSync(contentFile)).toBe(true);
      expect(fs.existsSync(instructionsFile)).toBe(true);

      // Verify manifest content
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      expect(manifest.status).toBe('draft');
      expect(manifest.content.title).toBe(content.title);
      expect(manifest.checklist).toBeDefined();
    });

    it('should support dry-run simulation without writing files to disk', async () => {
      const result = await connector.publish({
        destinationKey: 'assisted-linkedin',
        content,
        simulate: true,
      });

      expect(result.success).toBe(true);
      expect(result.isSimulated).toBe(true);
      expect(result.status).toBe('simulated');

      // No pack directory should be created on disk during simulation
      const files = fs.readdirSync(testOutputDir);
      expect(files).toHaveLength(0);
    });
  });

  describe('Verification and Status', () => {
    it('should verify pack exists and return draft status', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'assisted-linkedin',
        content,
      });

      const verifyResult = await connector.verify({
        destinationKey: 'assisted-linkedin',
        externalId: pubResult.externalId!,
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.status).toBe('draft');
    });

    it('should return verified: false when pack does not exist', async () => {
      const verifyResult = await connector.verify({
        destinationKey: 'assisted-linkedin',
        externalId: 'non-existent-pack-999',
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.verified).toBe(false);
      expect(verifyResult.error?.code).toBe('NOT_FOUND');
    });

    it('should report draft status for getStatus', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'assisted-linkedin',
        content,
      });

      const statusResult = await connector.getStatus({
        destinationKey: 'assisted-linkedin',
        externalId: pubResult.externalId!,
      });

      expect(statusResult.success).toBe(true);
      expect(statusResult.status).toBe('draft');
    });
  });

  describe('Deletion', () => {
    it('should delete prepared pack from disk', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'assisted-linkedin',
        content,
      });

      const packDir = path.join(testOutputDir, pubResult.externalId!);
      expect(fs.existsSync(packDir)).toBe(true);

      const deleteResult = await connector.delete({
        destinationKey: 'assisted-linkedin',
        externalId: pubResult.externalId!,
      });

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deleted).toBe(true);
      expect(fs.existsSync(packDir)).toBe(false);
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should safely sanitize directory resolution and prevent path traversal attacks', async () => {
      // Pack ID with path traversal characters gets sanitized
      const sanitizedResult = await connector.verify({
        destinationKey: 'assisted-linkedin',
        externalId: '../../etc/passwd',
      });

      // Does not throw an unhandled error or escape the output dir, reports not found safely
      expect(sanitizedResult.success).toBe(false);
      expect(sanitizedResult.error?.code).toBe('NOT_FOUND');
    });
  });
});
