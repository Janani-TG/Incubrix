import { describe, it, expect, beforeEach } from 'vitest';
import { MockConnector } from '../../src/connectors/MockConnector';
import { ContentPayload } from '../../src/connectors/types';

describe('MockConnector', () => {
  let connector: MockConnector;

  const sampleContent: ContentPayload = {
    title: 'Test Distribution Article',
    body: '# Markdown body for distribution testing',
    summary: 'A short summary',
    tags: ['engineering', 'architecture'],
    canonicalUrl: 'https://example.com/canonical',
    metadata: { author: 'Alice' },
  };

  beforeEach(() => {
    connector = new MockConnector();
  });

  describe('Publishing', () => {
    it('should deterministically publish content and store in-memory', async () => {
      const result = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
      });

      expect(result.success).toBe(true);
      expect(result.destinationKey).toBe('mock');
      expect(result.externalId).toBe('mock-1');
      expect(result.externalUrl).toBe('https://mock.incubrix.local/posts/mock-1');
      expect(result.status).toBe('published');
      expect(result.isSimulated).toBe(false);
      expect(result.timestamp).toBeDefined();

      // Check in-memory store
      const stored = connector.getItem('mock-1');
      expect(stored).toBeDefined();
      expect(stored?.content.title).toBe(sampleContent.title);
      expect(stored?.status).toBe('published');
    });

    it('should generate sequential deterministic IDs for subsequent publishes', async () => {
      const res1 = await connector.publish({ destinationKey: 'mock', content: sampleContent });
      const res2 = await connector.publish({ destinationKey: 'mock', content: sampleContent });

      expect(res1.externalId).toBe('mock-1');
      expect(res2.externalId).toBe('mock-2');
      expect(connector.getAllItems()).toHaveLength(2);
    });
  });

  describe('Verification and Status Behavior', () => {
    it('should verify an existing published item', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
      });

      const verifyResult = await connector.verify({
        destinationKey: 'mock',
        externalId: pubResult.externalId!,
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.status).toBe('published');
      expect(verifyResult.externalUrl).toBe(pubResult.externalUrl);
    });

    it('should return verified: false for a non-existent item', async () => {
      const verifyResult = await connector.verify({
        destinationKey: 'mock',
        externalId: 'non-existent-id',
      });

      expect(verifyResult.success).toBe(false);
      expect(verifyResult.verified).toBe(false);
      expect(verifyResult.status).toBe('unknown');
      expect(verifyResult.error?.code).toBe('CONTENT_NOT_FOUND');
    });

    it('should return current status of an existing item', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
      });

      const statusResult = await connector.getStatus({
        destinationKey: 'mock',
        externalId: pubResult.externalId!,
      });

      expect(statusResult.success).toBe(true);
      expect(statusResult.status).toBe('published');
      expect(statusResult.details?.url).toBe(pubResult.externalUrl);
    });

    it('should reflect status changes made to stored items', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
      });

      connector.setItemStatus(pubResult.externalId!, 'draft');

      const statusResult = await connector.getStatus({
        destinationKey: 'mock',
        externalId: pubResult.externalId!,
      });

      expect(statusResult.status).toBe('draft');
    });

    it('should return unknown status for non-existent item', async () => {
      const statusResult = await connector.getStatus({
        destinationKey: 'mock',
        externalId: 'non-existent-id',
      });

      expect(statusResult.success).toBe(false);
      expect(statusResult.status).toBe('unknown');
      expect(statusResult.error?.code).toBe('CONTENT_NOT_FOUND');
    });
  });

  describe('Deletion Behavior', () => {
    it('should delete an existing item and remove it from store', async () => {
      const pubResult = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
      });

      expect(connector.getItem(pubResult.externalId!)).toBeDefined();

      const deleteResult = await connector.delete({
        destinationKey: 'mock',
        externalId: pubResult.externalId!,
      });

      expect(deleteResult.success).toBe(true);
      expect(deleteResult.deleted).toBe(true);
      expect(deleteResult.isSimulated).toBe(false);
      expect(connector.getItem(pubResult.externalId!)).toBeUndefined();
    });

    it('should return failure when deleting non-existent item', async () => {
      const deleteResult = await connector.delete({
        destinationKey: 'mock',
        externalId: 'non-existent-id',
      });

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.deleted).toBe(false);
      expect(deleteResult.error?.code).toBe('CONTENT_NOT_FOUND');
    });
  });

  describe('Simulation / Dry-Run Behavior', () => {
    it('should clearly identify simulated publish results and not persist data', async () => {
      const simResult = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
        simulate: true,
      });

      expect(simResult.success).toBe(true);
      expect(simResult.isSimulated).toBe(true);
      expect(simResult.status).toBe('simulated');
      expect(simResult.externalId).toMatch(/^sim-mock-/);
      expect(simResult.metadata?.dryRun).toBe(true);

      // Simulation MUST NOT store items in live in-memory store
      expect(connector.getAllItems()).toHaveLength(0);
      expect(connector.getItem(simResult.externalId!)).toBeUndefined();
    });

    it('should support verification and getStatus on simulated IDs', async () => {
      const simId = 'sim-mock-1';

      const verifyResult = await connector.verify({
        destinationKey: 'mock',
        externalId: simId,
      });
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.status).toBe('simulated');
      expect(verifyResult.details?.isSimulated).toBe(true);

      const statusResult = await connector.getStatus({
        destinationKey: 'mock',
        externalId: simId,
      });
      expect(statusResult.success).toBe(true);
      expect(statusResult.status).toBe('simulated');
    });

    it('should support simulated deletion without modifying storage', async () => {
      // First publish a real item
      const pubResult = await connector.publish({
        destinationKey: 'mock',
        content: sampleContent,
      });

      expect(connector.getAllItems()).toHaveLength(1);

      // Now issue a simulated deletion
      const simDeleteResult = await connector.delete({
        destinationKey: 'mock',
        externalId: pubResult.externalId!,
        simulate: true,
      });

      expect(simDeleteResult.success).toBe(true);
      expect(simDeleteResult.deleted).toBe(true);
      expect(simDeleteResult.isSimulated).toBe(true);

      // Real item should still exist in store!
      expect(connector.getItem(pubResult.externalId!)).toBeDefined();
    });
  });
});
