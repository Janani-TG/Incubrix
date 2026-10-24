import type {
  HealthResponse,
  DestinationSummary,
  PublicationHistoryItem,
} from '../types/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import {
  ServerIcon,
  DestinationsIcon,
  ShieldIcon,
  ClockIcon,
  SimulatorIcon,
  CertificationIcon,
  ResultsIcon,
} from '../components/Icons';
import type { NavTab } from '../components/Navbar';

interface OverviewPageProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  destinations: DestinationSummary[];
  destinationsLoading: boolean;
  history: PublicationHistoryItem[];
  onNavigate: (tab: NavTab) => void;
  onRefreshAll: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  health,
  healthLoading,
  destinations,
  destinationsLoading,
  history,
  onNavigate,
  onRefreshAll,
}) => {
  const isHealthy = health?.status === 'ok';

  // Format uptime into human-readable format
  const formatUptime = (seconds?: number): string => {
    if (!seconds && seconds !== 0) return '—';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const simulationReadyCount = destinations.filter((d) => d.capabilities?.supportsSimulation).length;
  const publishReadyCount = destinations.filter((d) => d.capabilities?.canPublish).length;
  const rulesConfiguredCount = destinations.filter((d) => d.rulesConfigured).length;
  const verifyReadyCount = destinations.filter((d) => d.capabilities?.canVerify).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner / Welcome */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.6rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ zIndex: 1, maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <StatusBadge
              label={isHealthy ? 'ENGINE HEALTHY' : health ? 'ENGINE WARNING' : 'ENGINE OFFLINE'}
              variant={isHealthy ? 'success' : 'error'}
              dot
            />
            <StatusBadge label="DRY-RUN SIMULATION ACTIVE" variant="info" />
          </div>
          <h2
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: 'var(--text-main)',
              marginBottom: '6px',
            }}
          >
            IncuBrix Mission Control & Distribution Dashboard
          </h2>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Production-grade multi-platform technical syndication with destination policy enforcement,
            strict idempotency guarantees, asynchronous job handling, and connector certification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', zIndex: 1 }}>
          <button
            onClick={() => onNavigate('simulator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.65rem 1.2rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-gradient)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.88rem',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <SimulatorIcon size={16} /> Open Simulator
          </button>
          <button
            onClick={onRefreshAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            Sync Live Stats
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.2rem',
        }}
      >
        {/* Card 1: API Health */}
        <Card
          title={
            <>
              <ServerIcon size={18} style={{ color: 'var(--accent-primary)' }} /> API Service Health
            </>
          }
          headerAction={
            <StatusBadge
              label={healthLoading ? 'CHECKING...' : isHealthy ? '200 OK' : 'UNREACHABLE'}
              variant={isHealthy ? 'success' : 'error'}
              size="sm"
            />
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: isHealthy ? '#34d399' : '#f87171' }}>
              {isHealthy ? 'Online' : 'Degraded'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Environment:</span>
              <strong style={{ color: 'var(--text-main)' }}>{health?.environment || 'unknown'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Timestamp:</span>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '—'}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Destinations */}
        <Card
          title={
            <>
              <DestinationsIcon size={18} style={{ color: 'var(--accent-cyan)' }} /> Registered Destinations
            </>
          }
          headerAction={
            <button
              onClick={() => onNavigate('destinations')}
              style={{ fontSize: '0.76rem', color: 'var(--accent-cyan)', fontWeight: 600 }}
            >
              View All &rarr;
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {destinationsLoading ? '...' : destinations.length}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Publishing Capable:</span>
              <strong style={{ color: '#34d399' }}>{publishReadyCount} / {destinations.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Posting Rules Active:</span>
              <strong style={{ color: '#c084fc' }}>{rulesConfiguredCount} configured</strong>
            </div>
          </div>
        </Card>

        {/* Card 3: Simulation Harness */}
        <Card
          title={
            <>
              <ShieldIcon size={18} style={{ color: '#38bdf8' }} /> Simulation Guard
            </>
          }
          headerAction={<StatusBadge label="SECURE" variant="info" size="sm" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
              {simulationReadyCount} Ready
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Dry-Run Safety:</span>
              <strong style={{ color: '#38bdf8' }}>Enforced (Mock Mode)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Verification Support:</span>
              <strong style={{ color: 'var(--text-main)' }}>{verifyReadyCount} Connectors</strong>
            </div>
          </div>
        </Card>

        {/* Card 4: Engine Uptime */}
        <Card
          title={
            <>
              <ClockIcon size={18} style={{ color: '#fbbf24' }} /> Service Uptime
            </>
          }
          headerAction={<StatusBadge label="LIVE PROCESS" variant="warning" size="sm" />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
              {formatUptime(health?.uptime)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Node.js & Express:</span>
              <strong style={{ color: 'var(--text-main)' }}>Active (Port 3000)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Publications in Session:</span>
              <strong style={{ color: 'var(--text-main)' }}>{history.length} logged</strong>
            </div>
          </div>
        </Card>
      </div>

      {/* Two Column Layout: Quick Actions & Registered Destination Quick List */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Quick Nav Actions */}
        <Card
          title="Engine Capabilities & Workflows"
          subtitle="Explore the key operational pillars of the IncuBrix distribution network"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div
              onClick={() => onNavigate('simulator')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.9rem 1rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <SimulatorIcon size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    Publish Simulator
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Submit content to any connector with mandatory Idempotency-Key
                  </div>
                </div>
              </div>
              <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>&rarr;</span>
            </div>

            <div
              onClick={() => onNavigate('destinations')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.9rem 1rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  <DestinationsIcon size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    Connector Registry & Posting Rules
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Inspect DEV.to, Ghost, Discourse, Lemmy, Webhook, and Assisted connectors
                  </div>
                </div>
              </div>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>&rarr;</span>
            </div>

            <div
              onClick={() => onNavigate('certification')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.9rem 1rem',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--status-success)',
                  }}
                >
                  <CertificationIcon size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                    Connector Certification Suite
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Review contract verification results and execute mock certification
                  </div>
                </div>
              </div>
              <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>&rarr;</span>
            </div>
          </div>
        </Card>

        {/* Active Destination Quick Glance */}
        <Card
          title="Active Connectors"
          subtitle="Real-time registry from GET /api/v1/destinations"
          headerAction={
            <button
              onClick={() => onNavigate('destinations')}
              style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}
            >
              Details &rarr;
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {destinations.slice(0, 6).map((dest) => (
              <div
                key={dest.destinationKey}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.8rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                  >
                    {dest.destinationKey}
                  </code>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {dest.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {dest.capabilities?.canPublish && <StatusBadge label="PUB" variant="success" size="sm" />}
                  {dest.capabilities?.canVerify && <StatusBadge label="VER" variant="info" size="sm" />}
                  {dest.capabilities?.canDelete && <StatusBadge label="DEL" variant="warning" size="sm" />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Session Activity Preview */}
      <Card
        title={
          <>
            <ResultsIcon size={18} style={{ color: 'var(--accent-purple)' }} /> Recent Simulator Publications
          </>
        }
        subtitle="Audit log of publications executed during this active browser session"
        headerAction={
          history.length > 0 ? (
            <button
              onClick={() => onNavigate('results')}
              style={{ fontSize: '0.78rem', color: 'var(--accent-purple)', fontWeight: 600 }}
            >
              Full Results View &rarr;
            </button>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)', fontSize: '0.86rem' }}>
            No simulated publications executed yet in this session.{' '}
            <button
              onClick={() => onNavigate('simulator')}
              style={{ color: 'var(--accent-primary)', fontWeight: 600, textDecoration: 'underline' }}
            >
              Launch the Publish Simulator
            </button>{' '}
            to test syndication and idempotency.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)', textAlign: 'left' }}>
                  <th style={{ padding: '0.6rem 0.8rem' }}>DESTINATION</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>TITLE</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>IDEMPOTENCY KEY</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>STATUS</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>OUTCOME</th>
                  <th style={{ padding: '0.6rem 0.8rem' }}>TIME</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 5).map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <td style={{ padding: '0.6rem 0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      {item.destinationKey}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {item.idempotencyKey.substring(0, 16)}...
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>
                      <StatusBadge
                        label={item.status}
                        variant={item.status === 'success' ? 'success' : item.status === 'blocked' ? 'warning' : 'error'}
                        size="sm"
                      />
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>
                      {item.isCached ? (
                        <StatusBadge label="REPLAY (CACHED)" variant="purple" size="sm" />
                      ) : (
                        <StatusBadge label="FRESH" variant="info" size="sm" />
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                      {new Date(item.submittedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
