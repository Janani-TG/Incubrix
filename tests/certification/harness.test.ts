import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorCertificationHarness } from '../../src/certification/ConnectorCertificationHarness';
import { MockConnector } from '../../src/connectors/MockConnector';
import { WebhookConnector } from '../../src/connectors/implementations/WebhookConnector';
import { MockHttpClient } from '../../src/connectors/http/MockHttpClient';

describe('ConnectorCertificationHarness', () => {
  let harness: ConnectorCertificationHarness;

  beforeEach(() => {
    harness = new ConnectorCertificationHarness();
  });

  describe('Mock / Offline Certification', () => {
    it('should certify fully-capable connector in mock mode and record all operations', async () => {
      const mockConn = new MockConnector({ destinationKey: 'mock-cert-1' });

      const report = await harness.certify(mockConn, { mode: 'mock' });

      expect(report.isCertified).toBe(true);
      expect(report.environment).toBe('mock');
      expect(report.liveOptIn).toBe(false);
      expect(report.destinationKey).toBe('mock-cert-1');
      expect(report.summary.failed).toBe(0);
      expect(report.summary.passed).toBeGreaterThanOrEqual(4);

      const checkNames = report.checks.map((c) => c.name);
      expect(checkNames).toContain('Publish Operation');
      expect(checkNames).toContain('Verify Operation');
      expect(checkNames).toContain('GetStatus Operation');
      expect(checkNames).toContain('Delete & Cleanup Operation');
    });

    it('should certify connectors with asymmetric capabilities and verify explicit unsupported contracts', async () => {
      const mockHttp = new MockHttpClient();
      mockHttp.setDefaultHandler(() => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {},
      }));

      const webhookConn = new WebhookConnector({
        webhookUrl: 'https://webhook.site/test',
        secret: 'test-secret',
        httpClient: mockHttp,
      });

      const report = await harness.certify(webhookConn, { mode: 'mock' });

      expect(report.isCertified).toBe(true);
      expect(report.environment).toBe('mock');

      const unsupportedVerify = report.checks.find((c) => c.name === 'Unsupported Verify Contract');
      const unsupportedStatus = report.checks.find((c) => c.name === 'Unsupported GetStatus Contract');
      const unsupportedDelete = report.checks.find((c) => c.name === 'Unsupported Delete Contract');

      expect(unsupportedVerify?.status).toBe('passed');
      expect(unsupportedStatus?.status).toBe('passed');
      expect(unsupportedDelete?.status).toBe('passed');
    });

    it('should NEVER label mock certification as live certified', async () => {
      const mockConn = new MockConnector();

      const report = await harness.certify(mockConn, { mode: 'mock' });

      expect(report.environment).toBe('mock');
      expect(report.liveOptIn).toBe(false);
    });
  });

  describe('Live Certification Guards', () => {
    it('should reject live certification mode if allowLive is not explicitly opted into', async () => {
      const mockConn = new MockConnector();

      const report = await harness.certify(mockConn, {
        mode: 'live',
        allowLive: false, // Not opted in
      });

      expect(report.isCertified).toBe(false);
      expect(report.summary.unverified).toBeGreaterThan(0);
      expect(report.checks[0]?.status).toBe('unverified');
      expect(report.checks[0]?.message).toContain('allowLive flag was not explicitly provided');
    });
  });

  describe('Failure Reporting', () => {
    it('should mark certification as not certified when an operation fails', async () => {
      const failingConn = new MockConnector({ destinationKey: 'failing-dest' });
      failingConn.setFailPublish(true); // Inject failure

      const report = await harness.certify(failingConn, { mode: 'mock' });

      expect(report.isCertified).toBe(false);
      expect(report.summary.failed).toBeGreaterThan(0);

      const pubCheck = report.checks.find((c) => c.name === 'Publish Operation');
      expect(pubCheck?.status).toBe('failed');
    });
  });
});
