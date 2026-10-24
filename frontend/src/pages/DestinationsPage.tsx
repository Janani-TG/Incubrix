import { useState } from 'react';
import type { DestinationSummary, DestinationDetail } from '../types/api';
import { api } from '../services/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';
import { ErrorBanner } from '../components/ErrorBanner';
import { EmptyState } from '../components/EmptyState';
import {
  DestinationsIcon,
  SearchIcon,
  CheckIcon,
  CrossIcon,
  SimulatorIcon,
  EyeIcon,
  RefreshIcon,
} from '../components/Icons';

interface DestinationsPageProps {
  destinations: DestinationSummary[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSelectForPublish: (destinationKey: string) => void;
}

export const DestinationsPage: React.FC<DestinationsPageProps> = ({
  destinations,
  loading,
  error,
  onRefresh,
  onSelectForPublish,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCapability, setFilterCapability] = useState<string>('all');
  const [selectedDestination, setSelectedDestination] = useState<DestinationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Filter destinations
  const filtered = destinations.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.destinationKey.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterCapability === 'canPublish') return d.capabilities?.canPublish;
    if (filterCapability === 'canVerify') return d.capabilities?.canVerify;
    if (filterCapability === 'canGetStatus') return d.capabilities?.canGetStatus;
    if (filterCapability === 'canDelete') return d.capabilities?.canDelete;
    if (filterCapability === 'supportsSimulation') return d.capabilities?.supportsSimulation;
    if (filterCapability === 'rulesConfigured') return d.rulesConfigured;

    return true;
  });

  const handleInspect = async (destinationKey: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const { destination } = await api.getDestination(destinationKey);
      setSelectedDestination(destination);
    } catch (err: any) {
      setDetailError(err.message || `Failed to fetch details for ${destinationKey}`);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DestinationsIcon size={24} style={{ color: 'var(--accent-primary)' }} />
            Destination Connectors & Capability Matrix
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Inspect active distribution connectors, declared capabilities, and posting rules policies.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.55rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            fontSize: '0.84rem',
            fontWeight: 600,
          }}
        >
          <RefreshIcon size={14} className={loading ? 'animate-spin' : ''} /> Refresh Connectors
        </button>
      </div>

      <ErrorBanner error={error} onRetry={onRefresh} />

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem 1.2rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
          <SearchIcon
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)',
            }}
          />
          <input
            type="text"
            placeholder="Search destination key or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '36px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600 }}>Filter:</span>
          <select
            value={filterCapability}
            onChange={(e) => setFilterCapability(e.target.value)}
            style={{ minWidth: '180px' }}
          >
            <option value="all">All Connectors ({destinations.length})</option>
            <option value="canPublish">Can Publish</option>
            <option value="canVerify">Can Verify</option>
            <option value="canGetStatus">Can Get Status</option>
            <option value="canDelete">Can Delete / Cleanup</option>
            <option value="supportsSimulation">Supports Simulation</option>
            <option value="rulesConfigured">Posting Rules Configured</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading && destinations.length === 0 ? (
        <LoadingState message="Discovering registered connectors from /api/v1/destinations..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<DestinationsIcon size={32} />}
          title="No connectors found"
          description={
            searchTerm || filterCapability !== 'all'
              ? 'No connectors matched your search and filter criteria. Try resetting the filters.'
              : 'No connectors are currently registered in the backend.'
          }
          action={
            searchTerm || filterCapability !== 'all' ? (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterCapability('all');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.84rem',
                }}
              >
                Clear Filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.2rem',
          }}
        >
          {filtered.map((dest) => {
            const caps = dest.capabilities || {};
            return (
              <Card
                key={dest.destinationKey}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                      }}
                    >
                      {dest.destinationKey}
                    </code>
                    <span style={{ fontSize: '0.96rem' }}>{dest.name}</span>
                  </div>
                }
                headerAction={
                  <StatusBadge
                    label={dest.rulesConfigured ? 'RULES ACTIVE' : 'NO RULES'}
                    variant={dest.rulesConfigured ? 'purple' : 'neutral'}
                    size="sm"
                  />
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Capabilities List */}
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Declared Capabilities
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <CapabilityItem label="Publishing" supported={caps.canPublish} />
                      <CapabilityItem label="Simulation" supported={caps.supportsSimulation} />
                      <CapabilityItem label="Verification" supported={caps.canVerify} />
                      <CapabilityItem label="Remote Status" supported={caps.canGetStatus} />
                      <CapabilityItem label="Deletion / Cleanup" supported={caps.canDelete} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '0.8rem',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <button
                      onClick={() => onSelectForPublish(dest.destinationKey)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '0.55rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: 'var(--accent-primary)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                      }}
                    >
                      <SimulatorIcon size={14} /> Simulate Publish
                    </button>
                    <button
                      onClick={() => handleInspect(dest.destinationKey)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.55rem 0.9rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                      }}
                    >
                      <EyeIcon size={14} /> Details
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Destination Details Modal */}
      {(selectedDestination || detailLoading || detailError) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={() => {
            setSelectedDestination(null);
            setDetailError(null);
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.8rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading ? (
              <LoadingState message="Fetching connector specification..." />
            ) : detailError ? (
              <div>
                <ErrorBanner error={detailError} />
                <button
                  onClick={() => setDetailError(null)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-main)',
                  }}
                >
                  Close
                </button>
              </div>
            ) : selectedDestination ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: 'var(--accent-primary)',
                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {selectedDestination.destinationKey}
                      </code>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {selectedDestination.name}
                      </h3>
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Contract specification and active posting rules configuration
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDestination(null)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <CrossIcon size={16} />
                  </button>
                </div>

                {/* Capabilities */}
                <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Supported Capabilities
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                    <CapabilityItem label="canPublish" supported={selectedDestination.capabilities.canPublish} />
                    <CapabilityItem label="canVerify" supported={selectedDestination.capabilities.canVerify} />
                    <CapabilityItem label="canGetStatus" supported={selectedDestination.capabilities.canGetStatus} />
                    <CapabilityItem label="canDelete" supported={selectedDestination.capabilities.canDelete} />
                    <CapabilityItem label="supportsSimulation" supported={selectedDestination.capabilities.supportsSimulation} />
                  </div>
                </div>

                {/* Posting Rules */}
                <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      Destination Posting Rules
                    </div>
                    <StatusBadge
                      label={selectedDestination.rules ? 'ENFORCED' : 'DEFAULT POLICY'}
                      variant={selectedDestination.rules ? 'purple' : 'neutral'}
                      size="sm"
                    />
                  </div>
                  {selectedDestination.rules ? (
                    <pre
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        padding: '0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        color: '#a5b4fc',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(selectedDestination.rules, null, 2)}
                    </pre>
                  ) : (
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                      No destination-specific rate limits or content restrictions configured. General platform rules apply.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => {
                      const key = selectedDestination.destinationKey;
                      setSelectedDestination(null);
                      onSelectForPublish(key);
                    }}
                    style={{
                      padding: '0.6rem 1.2rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--accent-gradient)',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.86rem',
                    }}
                  >
                    Open in Publish Simulator &rarr;
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const CapabilityItem: React.FC<{ label: string; supported: boolean }> = ({ label, supported }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.8rem',
      color: supported ? 'var(--text-main)' : 'var(--text-dim)',
    }}
  >
    <div
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: supported ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.1)',
        color: supported ? 'var(--status-success)' : 'var(--text-dim)',
      }}
    >
      {supported ? <CheckIcon size={11} /> : <CrossIcon size={11} />}
    </div>
    <span style={{ fontWeight: supported ? 600 : 400 }}>{label}</span>
  </div>
);
