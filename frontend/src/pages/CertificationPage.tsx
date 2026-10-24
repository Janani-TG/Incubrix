import { useState, useEffect, useCallback } from 'react';
import type {
  CertificationReport,
  DestinationSummary,
} from '../types/api';
import { api } from '../services/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import {
  CertificationIcon,
  CheckCircleIcon,
  CrossIcon,
  PlayIcon,
  TerminalIcon,
  RefreshIcon,
} from '../components/Icons';

interface CertificationPageProps {
  destinations: DestinationSummary[];
}

export const CertificationPage: React.FC<CertificationPageProps> = ({ destinations }) => {
  const [reports, setReports] = useState<CertificationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningCert, setRunningCert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { reports: fetchedReports } = await api.listCertifications();
      setReports(fetchedReports || []);
      if (fetchedReports && fetchedReports.length > 0) {
        setExpandedReportId((prev) => prev || fetchedReports[0].runId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve certification records from /api/v1/certification');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { reports: fetchedReports } = await api.listCertifications();
        if (active) {
          setReports(fetchedReports || []);
          if (fetchedReports && fetchedReports.length > 0) {
            setExpandedReportId((prev) => prev || fetchedReports[0].runId);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Failed to retrieve certification records from /api/v1/certification');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleRunCertification = async () => {
    setRunningCert(true);
    setError(null);
    try {
      const target = selectedDestination === 'all' ? undefined : selectedDestination;
      const res = await api.runCertification(target);
      if (res.reports && res.reports.length > 0) {
        setReports((prev) => [...res.reports, ...prev]);
        setExpandedReportId(res.reports[0].runId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run certification suite via /api/v1/certification/run');
    } finally {
      setRunningCert(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CertificationIcon size={24} style={{ color: 'var(--status-success)' }} />
            Connector Certification Suite & Contract Verification
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Verify that connectors adhere to the standardized distribution contracts (Publish, Verify, GetStatus, Delete/Cleanup).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            disabled={runningCert}
            style={{ width: 'auto', minWidth: '160px' }}
          >
            <option value="all">All Connectors ({destinations.length})</option>
            {destinations.map((d) => (
              <option key={d.destinationKey} value={d.destinationKey}>
                {d.name} ({d.destinationKey})
              </option>
            ))}
          </select>

          <button
            onClick={handleRunCertification}
            disabled={runningCert}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: 'var(--shadow-glow)',
              cursor: runningCert ? 'not-allowed' : 'pointer',
            }}
          >
            {runningCert ? (
              <>
                <RefreshIcon size={14} className="animate-spin" /> Certifying...
              </>
            ) : (
              <>
                <PlayIcon size={14} /> Run Certification
              </>
            )}
          </button>

          <button
            onClick={fetchReports}
            disabled={loading || runningCert}
            style={{
              padding: '0.55rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
            }}
            title="Refresh reports"
          >
            <RefreshIcon size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <ErrorBanner error={error} onRetry={fetchReports} onDismiss={() => setError(null)} />

      {/* CLI Certification Guide Card */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TerminalIcon size={18} style={{ color: 'var(--accent-primary)' }} />
            CLI Certification Runner & Safe Harness
          </div>
        }
        subtitle="Certification can also be executed independently via terminal commands with mock/live isolation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            The IncuBrix certification harness validates destination connectors against standardized lifecycle contracts
            with test content cleanup and sensitive credential redaction:
          </p>

          <div
            style={{
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.8rem 1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.82rem',
              color: '#a5b4fc',
              lineHeight: 1.6,
            }}
          >
            <div style={{ color: 'var(--text-dim)' }}># Run certification across all registered connectors in mock mode:</div>
            <div style={{ color: '#38bdf8' }}>npm run certify</div>
            <div style={{ color: 'var(--text-dim)', marginTop: '6px' }}># Or run directly via tsx with targeted flags:</div>
            <div style={{ color: '#38bdf8' }}>npx tsx src/cli/certify.ts --destination devto --out artifacts/certification</div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-dim)', paddingTop: '4px' }}>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>Contract 1:</strong> Publish Operation
            </div>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>Contract 2:</strong> Verify Operation
            </div>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>Contract 3:</strong> GetStatus Query
            </div>
            <div>
              <strong style={{ color: 'var(--text-main)' }}>Contract 4:</strong> Delete / Cleanup
            </div>
          </div>
        </div>
      </Card>

      {/* Certification Reports Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Recorded Certification Reports ({reports.length})
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Data sourced live from <code>GET /api/v1/certification</code>
          </span>
        </div>

        {loading && reports.length === 0 ? (
          <LoadingState message="Fetching certification reports from engine..." />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<CertificationIcon size={36} />}
            title="No Stored Certification Reports"
            description="No certification runs have been recorded in the current backend session yet. You can trigger a real mock certification run above using the 'Run Certification' button, or execute 'npm run certify' in your terminal."
            action={
              <button
                onClick={handleRunCertification}
                disabled={runningCert}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-gradient)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                }}
              >
                Run Mock Certification Now
              </button>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reports.map((report) => {
              const isExpanded = expandedReportId === report.runId;
              const summary = report.summary || { passed: 0, failed: 0, skipped: 0, unverified: 0 };
              return (
                <Card
                  key={report.runId}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <code
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {report.destinationKey}
                      </code>
                      <span style={{ fontSize: '0.98rem' }}>{report.connectorName}</span>
                    </div>
                  }
                  headerAction={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <StatusBadge
                        label={report.isCertified ? 'CERTIFIED' : 'FAILED'}
                        variant={report.isCertified ? 'success' : 'error'}
                        dot
                      />
                      <StatusBadge
                        label={report.environment.toUpperCase()}
                        variant={report.environment === 'live' ? 'warning' : 'info'}
                        size="sm"
                      />
                      <button
                        onClick={() => setExpandedReportId(isExpanded ? null : report.runId)}
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--accent-primary)',
                          fontWeight: 600,
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-surface-elevated)',
                        }}
                      >
                        {isExpanded ? 'Collapse' : 'Inspect Checks'}
                      </button>
                    </div>
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {/* Summary row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        padding: '0.6rem 0.9rem',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-dim)' }}>
                          Run ID: <code style={{ color: 'var(--text-main)' }}>{report.runId}</code>
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>
                          Duration: <strong style={{ color: 'var(--text-main)' }}>{report.totalDurationMs}ms</strong>
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <StatusBadge label={`${summary.passed} PASSED`} variant="success" size="sm" />
                        {summary.failed > 0 && <StatusBadge label={`${summary.failed} FAILED`} variant="error" size="sm" />}
                        {summary.skipped > 0 && <StatusBadge label={`${summary.skipped} SKIPPED`} variant="warning" size="sm" />}
                        {summary.unverified > 0 && <StatusBadge label={`${summary.unverified} UNVERIFIED`} variant="neutral" size="sm" />}
                      </div>
                    </div>

                    {/* Detailed checks if expanded */}
                    {isExpanded && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '4px' }}>
                          Contract Checks Execution Breakdown
                        </div>
                        {report.checks.map((check, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              padding: '0.65rem 0.9rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-subtle)',
                              gap: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor:
                                    check.status === 'passed'
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : check.status === 'failed'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : 'rgba(245, 158, 11, 0.15)',
                                  color:
                                    check.status === 'passed'
                                      ? 'var(--status-success)'
                                      : check.status === 'failed'
                                      ? 'var(--status-error)'
                                      : 'var(--status-warning)',
                                  marginTop: '2px',
                                }}
                              >
                                {check.status === 'passed' ? (
                                  <CheckCircleIcon size={12} />
                                ) : (
                                  <CrossIcon size={12} />
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  {check.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {check.message}
                                </div>
                                {check.details && (
                                  <pre
                                    style={{
                                      backgroundColor: 'var(--bg-input)',
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.74rem',
                                      color: '#a5b4fc',
                                      marginTop: '4px',
                                      display: 'inline-block',
                                    }}
                                  >
                                    {JSON.stringify(check.details)}
                                  </pre>
                                )}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                              {check.durationMs}ms
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
