import { describe, it, expect } from 'vitest';
import { MockConnector } from '../../src/connectors/MockConnector';
import { ConnectorError } from '../../src/connectors/errors';
import { ContentPayload } from '../../src/connectors/types';

describe('Connector Capabilities and Error Handling', () => {
  const sampleContent: ContentPayload = {
    title: 'Capability Testing Article',
    body: 'Sample body for capability tests.',
  };

  describe('Explicit Unsupported Capabilities', () => {
    it('should explicitly represent unsupported publish operations', async () => {
      const restrictedConnector = new MockConnector({
        destinationKey: 'read-only',
        capabilities: { canPublish: false },
      });

      const result = await restrictedConnector.publish({
        destinationKey: 'read-only',
        content: sampleContent,
      });

      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.unsupportedReason).toContain('Publishing is not supported');
      expect(result.error?.code).toBe('UNSUPPORTED_CAPABILITY');
      expect(result.status).toBe('failed');
    });

    it('should explicitly represent unsupported verify operations', async () => {
      const restrictedConnector = new MockConnector({
        destinationKey: 'no-verify',
        capabilities: { canVerify: false },
      });

      const result = await restrictedConnector.verify({
        destinationKey: 'no-verify',
        externalId: 'ext-123',
      });

      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.unsupportedReason).toContain('Verification is not supported');
      expect(result.error?.code).toBe('UNSUPPORTED_CAPABILITY');
    });

    it('should explicitly represent unsupported getStatus operations', async () => {
      const restrictedConnector = new MockConnector({
        destinationKey: 'no-status',
        capabilities: { canGetStatus: false },
      });

      const result = await restrictedConnector.getStatus({
        destinationKey: 'no-status',
        externalId: 'ext-123',
      });

      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.unsupportedReason).toContain('Status checking is not supported');
      expect(result.error?.code).toBe('UNSUPPORTED_CAPABILITY');
    });

    it('should explicitly represent unsupported delete operations', async () => {
      const restrictedConnector = new MockConnector({
        destinationKey: 'no-delete',
        capabilities: { canDelete: false },
      });

      const result = await restrictedConnector.delete({
        destinationKey: 'no-delete',
        externalId: 'ext-123',
      });

      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.deleted).toBe(false);
      expect(result.unsupportedReason).toContain('Deletion is not supported');
      expect(result.error?.code).toBe('UNSUPPORTED_CAPABILITY');
    });

    it('should explicitly reject simulation when connector does not support simulation', async () => {
      const noSimConnector = new MockConnector({
        destinationKey: 'no-sim',
        capabilities: { supportsSimulation: false },
      });

      const result = await noSimConnector.publish({
        destinationKey: 'no-sim',
        content: sampleContent,
        simulate: true,
      });

      expect(result.success).toBe(false);
      expect(result.unsupported).toBe(true);
      expect(result.error?.code).toBe('SIMULATION_NOT_SUPPORTED');
    });
  });

  describe('Validation and Failure Injection', () => {
    const connector = new MockConnector();

    it('should reject publish requests with empty content title or body', async () => {
      const missingTitle = await connector.publish({
        destinationKey: 'mock',
        content: { title: '   ', body: 'some body' },
      });
      expect(missingTitle.success).toBe(false);
      expect(missingTitle.error?.code).toBe('INVALID_REQUEST');

      const missingBody = await connector.publish({
        destinationKey: 'mock',
        content: { title: 'Title', body: '   ' },
      });
      expect(missingBody.success).toBe(false);
      expect(missingBody.error?.code).toBe('INVALID_REQUEST');
    });

    it('should reject operations with missing externalId', async () => {
      const verifyRes = await connector.verify({ destinationKey: 'mock', externalId: '  ' });
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error?.code).toBe('INVALID_REQUEST');

      const statusRes = await connector.getStatus({ destinationKey: 'mock', externalId: '' });
      expect(statusRes.success).toBe(false);
      expect(statusRes.error?.code).toBe('INVALID_REQUEST');

      const deleteRes = await connector.delete({ destinationKey: 'mock', externalId: '' });
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error?.code).toBe('INVALID_REQUEST');
    });

    it('should handle simulated failure injections', async () => {
      connector.setFailPublish(true);
      const pubRes = await connector.publish({ destinationKey: 'mock', content: sampleContent });
      expect(pubRes.success).toBe(false);
      expect(pubRes.error?.code).toBe('PUBLISH_FAILED');

      connector.setFailPublish(false);
      connector.setFailVerify(true);
      const verifyRes = await connector.verify({ destinationKey: 'mock', externalId: 'mock-1' });
      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error?.code).toBe('VERIFY_FAILED');

      connector.setFailVerify(false);
      connector.setFailDelete(true);
      const deleteRes = await connector.delete({ destinationKey: 'mock', externalId: 'mock-1' });
      expect(deleteRes.success).toBe(false);
      expect(deleteRes.error?.code).toBe('DELETE_FAILED');
    });
  });

  describe('ConnectorError Structure', () => {
    it('should create standardized ConnectorError instances with correct HTTP status codes', () => {
      const notFoundErr = ConnectorError.notFound('target-dest');
      expect(notFoundErr.code).toBe('CONNECTOR_NOT_FOUND');
      expect(notFoundErr.statusCode).toBe(404);
      expect(notFoundErr.destinationKey).toBe('target-dest');
      expect(notFoundErr.toDetail()).toEqual({
        code: 'CONNECTOR_NOT_FOUND',
        message: "Connector for destination 'target-dest' not found.",
      });

      const dupErr = ConnectorError.duplicate('target-dest');
      expect(dupErr.code).toBe('DUPLICATE_CONNECTOR');
      expect(dupErr.statusCode).toBe(409);

      const unsuppErr = ConnectorError.unsupported('customAction', 'target-dest');
      expect(unsuppErr.code).toBe('UNSUPPORTED_CAPABILITY');
      expect(unsuppErr.statusCode).toBe(501);

      const invalidReqErr = ConnectorError.invalidRequest('Bad payload', 'target-dest', { field: 'title' });
      expect(invalidReqErr.code).toBe('INVALID_REQUEST');
      expect(invalidReqErr.statusCode).toBe(400);
      expect(invalidReqErr.toDetail().details).toEqual({ field: 'title' });
    });
  });
});
