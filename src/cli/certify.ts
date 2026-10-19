import fs from 'fs';
import path from 'path';
import { connectorRegistry, registerStandardConnectors } from '../connectors';
import { ConnectorCertificationHarness } from '../certification/ConnectorCertificationHarness';
import { CertificationReport } from '../certification/types';

/**
 * CLI runner for connector certification.
 * Usage:
 *   npx tsx src/cli/certify.ts [--destination <key>] [--live] [--out <dir>]
 */
export async function runCliCertification(args: string[]): Promise<number> {
  const destinationFlagIndex = args.findIndex((a) => a === '--destination' || a === '-d');
  const targetDestination = destinationFlagIndex !== -1 ? args[destinationFlagIndex + 1] : undefined;

  const isLive = args.includes('--live');
  const outFlagIndex = args.findIndex((a) => a === '--out' || a === '-o');
  const userOutDir = outFlagIndex !== -1 ? args[outFlagIndex + 1] : undefined;

  const outDir = path.resolve(process.cwd(), userOutDir || 'artifacts/certification');

  // Guard against path traversal
  const rootDir = process.cwd();
  if (!outDir.startsWith(rootDir)) {
    console.error(`Error: Output directory '${outDir}' must be inside project root.`);
    return 1;
  }

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // Initialize registry
  registerStandardConnectors(connectorRegistry);

  const harness = new ConnectorCertificationHarness();
  const connectors = targetDestination
    ? [connectorRegistry.get(targetDestination)]
    : connectorRegistry.getAll();

  console.log('====================================================');
  console.log(`IncuBrix Connector Certification Suite`);
  console.log(`Environment: ${isLive ? 'LIVE INTEGRATION' : 'MOCK / OFFLINE'}`);
  console.log(`Target Destination(s): ${targetDestination || 'ALL REGISTERED (' + connectors.length + ')'}`);
  console.log('====================================================\n');

  const reports: CertificationReport[] = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalUnverified = 0;

  for (const connector of connectors) {
    console.log(`--> Running certification for: [${connector.destinationKey}] ${connector.name}...`);
    const report = await harness.certify(connector, {
      mode: isLive ? 'live' : 'mock',
      allowLive: isLive,
    });
    reports.push(report);

    totalPassed += report.summary.passed;
    totalFailed += report.summary.failed;
    totalSkipped += report.summary.skipped;
    totalUnverified += report.summary.unverified;

    for (const check of report.checks) {
      const mark =
        check.status === 'passed' ? '✓' :
        check.status === 'failed' ? '✗' :
        check.status === 'skipped' ? '○' : '?';
      console.log(`   [${mark}] ${check.name}: ${check.status.toUpperCase()} (${check.durationMs}ms) - ${check.message}`);
    }

    console.log(`   Outcome: ${report.isCertified ? 'CERTIFIED' : 'NOT CERTIFIED'}\n`);
  }

  console.log('====================================================');
  console.log(`Summary: ${totalPassed} Passed | ${totalFailed} Failed | ${totalSkipped} Skipped | ${totalUnverified} Unverified`);
  console.log('====================================================');

  // Redact any possible accidental sensitive values from JSON output
  const cleanReports = JSON.parse(
    JSON.stringify(reports, (key, value) => {
      if (
        typeof key === 'string' &&
        key !== 'destinationKey' &&
        /(?:api[-_]?key|secret|token|auth|password|credential)/i.test(key)
      ) {
        return '[REDACTED]';
      }
      return value;
    })
  );

  const reportFileName = `certification-report-${Date.now()}.json`;
  const reportPath = path.join(outDir, reportFileName);
  fs.writeFileSync(reportPath, JSON.stringify(cleanReports, null, 2), 'utf-8');
  console.log(`JSON report saved to: ${reportPath}`);

  return totalFailed > 0 ? 1 : 0;
}

// Execute when invoked directly from CLI
if (require.main === module) {
  runCliCertification(process.argv.slice(2))
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((err) => {
      console.error('Fatal certification runner error:', err);
      process.exit(1);
    });
}
