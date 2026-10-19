import crypto from 'crypto';
import { Connector } from '../connectors/types';
import {
  CertificationCheck,
  CertificationOptions,
  CertificationReport,
} from './types';

/**
 * Repeatable harness that certifies connector capabilities using isolated test content.
 * Strictly distinguishes mock mode from live integration certification.
 */
export class ConnectorCertificationHarness {
  public async certify(
    connector: Connector,
    options: CertificationOptions = {}
  ): Promise<CertificationReport> {
    const runId = `cert-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const isLive = options.mode === 'live';
    const allowLive = options.allowLive === true;
    const environment: 'mock' | 'live' = isLive ? 'live' : 'mock';

    const checks: CertificationCheck[] = [];
    const testId = `test-${Date.now()}`;
    const testContent = {
      title: `[Certification ${testId}] Automated Capability Check`,
      body: `Isolated certification test body for connector '${connector.destinationKey}'. Unique run: ${runId}.`,
      summary: 'Certification test summary',
      tags: ['certification', 'test'],
    };

    let publishedExternalId: string | undefined;

    // Safety guard: if live mode requested without explicit opt-in, fail or mark unverified
    if (isLive && !allowLive) {
      checks.push({
        name: 'Live Execution Safety Guard',
        status: 'unverified',
        durationMs: 0,
        message: 'Live certification mode requested but allowLive flag was not explicitly provided.',
      });

      const completedAt = new Date().toISOString();
      return this.buildReport(
        runId,
        connector,
        environment,
        startedAt,
        completedAt,
        Date.now() - startTime,
        checks,
        false
      );
    }

    // 1. Publish Check
    if (connector.capabilities.canPublish) {
      const pubStart = Date.now();
      try {
        const pubResult = await connector.publish({
          destinationKey: connector.destinationKey,
          content: testContent,
          simulate: !isLive, // Mock mode uses dry-run simulation
        });

        const pubDuration = Date.now() - pubStart;

        if (pubResult.success) {
          publishedExternalId = pubResult.externalId;
          checks.push({
            name: 'Publish Operation',
            status: 'passed',
            durationMs: pubDuration,
            message: `Publish succeeded with externalId: ${pubResult.externalId}`,
            details: { isSimulated: pubResult.isSimulated, status: pubResult.status },
          });
        } else {
          checks.push({
            name: 'Publish Operation',
            status: 'failed',
            durationMs: pubDuration,
            message: pubResult.error?.message || 'Publish operation returned unsuccessful status.',
            details: pubResult.error ? ({ ...pubResult.error } as Record<string, unknown>) : undefined,
          });
        }
      } catch (err: unknown) {
        checks.push({
          name: 'Publish Operation',
          status: 'failed',
          durationMs: Date.now() - pubStart,
          message: (err as Error).message,
        });
      }
    } else {
      checks.push({
        name: 'Publish Operation',
        status: 'skipped',
        durationMs: 0,
        message: 'Publishing is not declared in connector capabilities.',
      });
    }

    // 2. Verification Check
    if (connector.capabilities.canVerify) {
      if (publishedExternalId) {
        const verifyStart = Date.now();
        try {
          const verifyResult = await connector.verify({
            destinationKey: connector.destinationKey,
            externalId: publishedExternalId,
            simulate: !isLive,
          });
          const verifyDuration = Date.now() - verifyStart;

          if (verifyResult.success && verifyResult.verified) {
            checks.push({
              name: 'Verify Operation',
              status: 'passed',
              durationMs: verifyDuration,
              message: `Verification confirmed for externalId: ${publishedExternalId}`,
              details: verifyResult.details,
            });
          } else {
            checks.push({
              name: 'Verify Operation',
              status: 'failed',
              durationMs: verifyDuration,
              message: verifyResult.error?.message || 'Verification failed to confirm content presence.',
            });
          }
        } catch (err: unknown) {
          checks.push({
            name: 'Verify Operation',
            status: 'failed',
            durationMs: Date.now() - verifyStart,
            message: (err as Error).message,
          });
        }
      } else {
        checks.push({
          name: 'Verify Operation',
          status: 'skipped',
          durationMs: 0,
          message: 'Skipped verification because publication did not produce an externalId.',
        });
      }
    } else {
      // Explicitly check that unsupported verification does NOT claim success
      const unsuppStart = Date.now();
      const unsuppResult = await connector.verify({
        destinationKey: connector.destinationKey,
        externalId: 'test-unsupported-id',
        simulate: !isLive,
      });
      const unsuppDuration = Date.now() - unsuppStart;

      if (!unsuppResult.success && unsuppResult.unsupported === true) {
        checks.push({
          name: 'Unsupported Verify Contract',
          status: 'passed',
          durationMs: unsuppDuration,
          message: 'Connector correctly reports verification as unsupported.',
        });
      } else {
        checks.push({
          name: 'Unsupported Verify Contract',
          status: 'failed',
          durationMs: unsuppDuration,
          message: 'Connector falsely claimed success for undeclared verify capability.',
        });
      }
    }

    // 3. Status Query Check
    if (connector.capabilities.canGetStatus) {
      if (publishedExternalId) {
        const statusStart = Date.now();
        try {
          const statusResult = await connector.getStatus({
            destinationKey: connector.destinationKey,
            externalId: publishedExternalId,
            simulate: !isLive,
          });
          const statusDuration = Date.now() - statusStart;

          if (statusResult.success) {
            checks.push({
              name: 'GetStatus Operation',
              status: 'passed',
              durationMs: statusDuration,
              message: `Status query returned: ${statusResult.status}`,
              details: statusResult.details,
            });
          } else {
            checks.push({
              name: 'GetStatus Operation',
              status: 'failed',
              durationMs: statusDuration,
              message: statusResult.error?.message || 'Status query failed.',
            });
          }
        } catch (err: unknown) {
          checks.push({
            name: 'GetStatus Operation',
            status: 'failed',
            durationMs: Date.now() - statusStart,
            message: (err as Error).message,
          });
        }
      } else {
        checks.push({
          name: 'GetStatus Operation',
          status: 'skipped',
          durationMs: 0,
          message: 'Skipped status query because publication did not produce an externalId.',
        });
      }
    } else {
      // Confirm unsupported getStatus
      const unsuppStart = Date.now();
      const unsuppResult = await connector.getStatus({
        destinationKey: connector.destinationKey,
        externalId: 'test-unsupported-id',
        simulate: !isLive,
      });
      const unsuppDuration = Date.now() - unsuppStart;

      if (!unsuppResult.success && unsuppResult.unsupported === true) {
        checks.push({
          name: 'Unsupported GetStatus Contract',
          status: 'passed',
          durationMs: unsuppDuration,
          message: 'Connector correctly reports getStatus as unsupported.',
        });
      } else {
        checks.push({
          name: 'Unsupported GetStatus Contract',
          status: 'failed',
          durationMs: unsuppDuration,
          message: 'Connector falsely claimed success for undeclared getStatus capability.',
        });
      }
    }

    // 4. Delete & Cleanup Check
    if (connector.capabilities.canDelete) {
      if (publishedExternalId) {
        const delStart = Date.now();
        try {
          const delResult = await connector.delete({
            destinationKey: connector.destinationKey,
            externalId: publishedExternalId,
            simulate: !isLive,
          });
          const delDuration = Date.now() - delStart;

          if (delResult.success && delResult.deleted) {
            checks.push({
              name: 'Delete & Cleanup Operation',
              status: 'passed',
              durationMs: delDuration,
              message: `Test content cleaned up successfully for externalId: ${publishedExternalId}`,
            });
          } else {
            checks.push({
              name: 'Delete & Cleanup Operation',
              status: 'failed',
              durationMs: delDuration,
              message: delResult.error?.message || 'Delete operation returned failure.',
            });
          }
        } catch (err: unknown) {
          checks.push({
            name: 'Delete & Cleanup Operation',
            status: 'failed',
            durationMs: Date.now() - delStart,
            message: (err as Error).message,
          });
        }
      } else {
        checks.push({
          name: 'Delete & Cleanup Operation',
          status: 'skipped',
          durationMs: 0,
          message: 'Skipped deletion because publication did not produce an externalId.',
        });
      }
    } else {
      // Confirm unsupported delete
      const unsuppStart = Date.now();
      const unsuppResult = await connector.delete({
        destinationKey: connector.destinationKey,
        externalId: 'test-unsupported-id',
      });
      const unsuppDuration = Date.now() - unsuppStart;

      if (!unsuppResult.success && unsuppResult.unsupported === true) {
        checks.push({
          name: 'Unsupported Delete Contract',
          status: 'passed',
          durationMs: unsuppDuration,
          message: 'Connector correctly reports deletion as unsupported.',
        });
      } else {
        checks.push({
          name: 'Unsupported Delete Contract',
          status: 'failed',
          durationMs: unsuppDuration,
          message: 'Connector falsely claimed success for undeclared delete capability.',
        });
      }
    }

    const completedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - startTime;
    const isCertified = checks.every((c) => c.status === 'passed' || c.status === 'skipped');

    return this.buildReport(
      runId,
      connector,
      environment,
      startedAt,
      completedAt,
      totalDurationMs,
      checks,
      isCertified,
      allowLive
    );
  }

  private buildReport(
    runId: string,
    connector: Connector,
    environment: 'mock' | 'live',
    startedAt: string,
    completedAt: string,
    totalDurationMs: number,
    checks: CertificationCheck[],
    isCertified: boolean,
    liveOptIn = false
  ): CertificationReport {
    const summary = {
      passed: checks.filter((c) => c.status === 'passed').length,
      failed: checks.filter((c) => c.status === 'failed').length,
      skipped: checks.filter((c) => c.status === 'skipped').length,
      unverified: checks.filter((c) => c.status === 'unverified').length,
    };

    return {
      runId,
      destinationKey: connector.destinationKey,
      connectorName: connector.name,
      environment,
      startedAt,
      completedAt,
      totalDurationMs,
      summary,
      checks,
      isCertified,
      liveOptIn,
    };
  }
}
