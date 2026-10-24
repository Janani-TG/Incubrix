import { useState } from 'react';
import type {
  PublicationHistoryItem,
} from '../types/api';
import { api } from '../services/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  ResultsIcon,
  CheckCircleIcon,
  CopyIcon,
  TrashIcon,
  EyeIcon,
} from '../components/Icons';

interface ResultsPageProps {
  history: PublicationHistoryItem[];
  onClearHistory: () => void;
  onReplay: (item: PublicationHistoryItem) => void;
  onNavigateToSimulator: () => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  history,
  onClearHistory,
  onReplay,
  onNavigateToSimulator,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = (selectedId ? history.find((h) => h.id === selectedId) : null) || history[0] || null;
  const [filter, setFilter] = useState<'all' | 'success' | 'blocked' | 'error'>('all');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Operation states for Verify, Status, Delete
  const [opLoading, setOpLoading] = useState<string | null>(null);
  const [opResult, setOpResult] = useState<any>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: 'id' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const handleVerify = async (item: PublicationHistoryItem) => {
    if (!item.externalId) return;
    setOpLoading('verify');
    setOpResult(null);
    setOpError(null);
    try {
      const res = await api.verifyPublication(item.destinationKey, item.externalId);
      setOpResult({ type: 'Verification', data: res });
    } catch (err: any) {
      setOpError(err.message || 'Verification failed');
    } finally {
      setOpLoading(null);
    }
  };

  const handleGetStatus = async (item: PublicationHistoryItem) => {
    if (!item.externalId) return;
    setOpLoading('status');
    setOpResult(null);
    setOpError(null);
    try {
      const res = await api.getPublicationStatus(item.destinationKey, item.externalId);
      setOpResult({ type: 'Remote Status', data: res });
    } catch (err: any) {
      setOpError(err.message || 'Remote status query failed');
    } finally {
      setOpLoading(null);
    }
  };

  const handleDelete = async (item: PublicationHistoryItem) => {
    if (!item.externalId) return;
    if (!window.confirm(`Are you sure you want to test deletion of ${item.externalId}?`)) return;
    setOpLoading('delete');
    setOpResult(null);
    setOpError(null);
    try {
      const res = await api.deletePublication(item.destinationKey, item.externalId);
      setOpResult({ type: 'Deletion / Cleanup', data: res });
    } catch (err: any) {
      setOpError(err.message || 'Deletion failed');
    } finally {
      setOpLoading(null);
    }
  };

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    return item.status === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ResultsIcon size={24} style={{ color: 'var(--accent-purple)' }} />
            Publication Results, Idempotency & Lifecycle Operations
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Audit published payloads, inspect cache replay states, rule blocks, and execute verification/cleanup contracts.
          </p>
        </div>

        {history.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClearHistory}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.5rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <TrashIcon size={14} /> Clear Log
            </button>
          </div>
        )}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon={<ResultsIcon size={36} />}
          title="No Publication Results Yet"
          description="You haven't run any simulated publications in this session. Head to the Publish Simulator to test destinations."
          action={
            <button
              onClick={onNavigateToSimulator}
              style={{
                padding: '0.65rem 1.4rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-gradient)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.88rem',
              }}
            >
              Launch Simulator &rarr;
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Left Column: Result Details Inspector */}
          {selectedItem && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <Card
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Publication Outcome</span>
                    <code
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: 'var(--accent-primary)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {selectedItem.destinationKey}
                    </code>
                  </div>
                }
                headerAction={
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <StatusBadge
                      label={selectedItem.status}
                      variant={selectedItem.status === 'success' ? 'success' : selectedItem.status === 'blocked' ? 'warning' : 'error'}
                    />
                    {selectedItem.isCached && (
                      <StatusBadge label="CACHED REPLAY" variant="purple" />
                    )}
                  </div>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Status Banner */}
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor:
                        selectedItem.status === 'success'
                          ? 'var(--status-success-bg)'
                          : selectedItem.status === 'blocked'
                          ? 'var(--status-warning-bg)'
                          : 'var(--status-error-bg)',
                      border: `1px solid ${
                        selectedItem.status === 'success'
                          ? 'var(--status-success-border)'
                          : selectedItem.status === 'blocked'
                          ? 'var(--status-warning-border)'
                          : 'var(--status-error-border)'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                          DECISION
                        </div>
                        <div
                          style={{
                            fontSize: '1.25rem',
                            fontWeight: 800,
                            color: selectedItem.status === 'success' ? '#34d399' : selectedItem.status === 'blocked' ? '#fbbf24' : '#f87171',
                            textTransform: 'uppercase',
                          }}
                        >
                          {selectedItem.result?.decision || selectedItem.error?.decision || selectedItem.status}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-dim)' }}>
                          HTTP RESPONSE
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {selectedItem.statusCode || (selectedItem.status === 'success' ? (selectedItem.isCached ? 200 : 201) : 400)}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', marginTop: '8px', lineHeight: 1.45 }}>
                      {selectedItem.result?.error?.message ||
                        selectedItem.error?.message ||
                        (selectedItem.status === 'success'
                          ? 'Content successfully passed posting rules policy and was simulated.'
                          : 'Operation failed.')}
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.8rem' }}>
                    <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Simulated External ID
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <code style={{ fontSize: '0.86rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                          {selectedItem.externalId || '—'}
                        </code>
                        {selectedItem.externalId && (
                          <button
                            onClick={() => copyToClipboard(selectedItem.externalId!, 'id')}
                            style={{ color: copiedId ? '#34d399' : 'var(--text-dim)', padding: '2px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                            title="Copy External ID"
                          >
                            <CopyIcon size={14} /> {copiedId ? 'Copied' : ''}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Idempotency Key
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <code style={{ fontSize: '0.78rem', color: '#c084fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                          {selectedItem.idempotencyKey}
                        </code>
                        <button
                          onClick={() => copyToClipboard(selectedItem.idempotencyKey, 'id')}
                          style={{ color: 'var(--text-dim)', padding: '2px' }}
                          title="Copy Idempotency Key"
                        >
                          <CopyIcon size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Replay State
                      </div>
                      <div style={{ marginTop: '2px' }}>
                        {selectedItem.isCached ? (
                          <span style={{ color: '#c084fc', fontWeight: 700, fontSize: '0.85rem' }}>
                            ⚡ Cached Replay (Idempotent)
                          </span>
                        ) : (
                          <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '0.85rem' }}>
                            Fresh Execution
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Execution Timestamp
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                        {new Date(selectedItem.submittedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {/* Title & Body */}
                  <div style={{ backgroundColor: 'var(--bg-surface-elevated)', padding: '0.8rem 1rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                      Submitted Content
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                      {selectedItem.title}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {selectedItem.bodySnippet}...
                    </div>
                  </div>

                  {/* Policy Rule Violations Table if Blocked */}
                  {selectedItem.error?.violations && selectedItem.error.violations.length > 0 && (
                    <div
                      style={{
                        backgroundColor: 'var(--status-error-bg)',
                        border: '1px solid var(--status-error-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f87171', marginBottom: '6px' }}>
                        Posting Rules Evaluation: BLOCKED
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {selectedItem.error.violations.map((v, i) => (
                          <div
                            key={i}
                            style={{
                              backgroundColor: 'rgba(0, 0, 0, 0.25)',
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                              color: '#fecaca',
                            }}
                          >
                            <strong style={{ color: '#f87171' }}>[{v.ruleId}]</strong> {v.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Post-Publish Operations Action Bar */}
                  {selectedItem.externalId && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Lifecycle Verification & Operations Contract
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleVerify(selectedItem)}
                          disabled={opLoading !== null}
                          style={{
                            padding: '0.5rem 0.9rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(6, 182, 212, 0.15)',
                            border: '1px solid rgba(6, 182, 212, 0.3)',
                            color: '#38bdf8',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <CheckCircleIcon size={14} /> Verify Publication
                        </button>

                        <button
                          onClick={() => handleGetStatus(selectedItem)}
                          disabled={opLoading !== null}
                          style={{
                            padding: '0.5rem 0.9rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            color: 'var(--accent-primary)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <EyeIcon size={14} /> Check Remote Status
                        </button>

                        <button
                          onClick={() => handleDelete(selectedItem)}
                          disabled={opLoading !== null}
                          style={{
                            padding: '0.5rem 0.9rem',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <TrashIcon size={14} /> Delete / Cleanup
                        </button>
                      </div>

                      {/* Operation Response Box */}
                      {opError && <ErrorBanner error={opError} onDismiss={() => setOpError(null)} />}
                      {opResult && (
                        <div
                          style={{
                            backgroundColor: 'var(--bg-input)',
                            padding: '0.8rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.8rem',
                            marginTop: '6px',
                          }}
                        >
                          <div style={{ color: '#38bdf8', fontWeight: 700, marginBottom: '4px' }}>
                            {opResult.type} Result:
                          </div>
                          <pre style={{ color: '#a5b4fc', fontSize: '0.76rem', overflowX: 'auto', margin: 0 }}>
                            {JSON.stringify(opResult.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Raw JSON Inspector */}
                  <div style={{ backgroundColor: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '0.8rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                        Raw API Response Payload
                      </span>
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(selectedItem.result || selectedItem.error, null, 2), 'json')}
                        style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CopyIcon size={12} /> {copiedJson ? 'Copied!' : 'Copy JSON'}
                      </button>
                    </div>
                    <pre
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        padding: '0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.76rem',
                        color: '#94a3b8',
                        overflowX: 'auto',
                        maxHeight: '220px',
                      }}
                    >
                      {JSON.stringify(selectedItem.result || selectedItem.error, null, 2)}
                    </pre>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Right Column: Execution History List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Card
              title="Session Execution Audit Log"
              subtitle="Select any publication to inspect response headers, rules, or test idempotent replays"
            >
              {/* Filter pills */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {(['all', 'success', 'blocked', 'error'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      backgroundColor: filter === f ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                      color: filter === f ? '#ffffff' : 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      textTransform: 'capitalize',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {filteredHistory.length === 0 ? (
                <div style={{ padding: '1rem', color: 'var(--text-dim)', fontSize: '0.85rem', textAlign: 'center' }}>
                  No items matching filter '{filter}'.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '580px', overflowY: 'auto' }}>
                  {filteredHistory.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{
                          padding: '0.8rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-surface-elevated)',
                          border: isSelected ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                              {item.destinationKey}
                            </code>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                              {new Date(item.submittedAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <StatusBadge
                              label={item.status}
                              variant={item.status === 'success' ? 'success' : item.status === 'blocked' ? 'warning' : 'error'}
                              size="sm"
                            />
                            {item.isCached && <StatusBadge label="REPLAY" variant="purple" size="sm" />}
                          </div>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>
                            Key: {item.idempotencyKey.substring(0, 16)}...
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReplay(item);
                            }}
                            style={{
                              color: '#c084fc',
                              fontWeight: 700,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                          >
                            Replay in Simulator &rarr;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
