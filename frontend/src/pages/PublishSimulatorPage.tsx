import { useState } from 'react';
import type {
  DestinationSummary,
  PublishRequestBody,
  PublishResult,
  PublicationHistoryItem,
  Job,
} from '../types/api';
import { api, generateIdempotencyKey, IncubrixApiError } from '../services/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  SimulatorIcon,
  ShieldIcon,
  RefreshIcon,
  PlayIcon,
  CheckCircleIcon,
} from '../components/Icons';

interface PublishSimulatorPageProps {
  destinations: DestinationSummary[];
  preselectedDestination?: string;
  onPublishComplete: (item: PublicationHistoryItem) => void;
  lastUsedIdempotencyKey?: string;
}

export const PublishSimulatorPage: React.FC<PublishSimulatorPageProps> = ({
  destinations,
  preselectedDestination,
  onPublishComplete,
  lastUsedIdempotencyKey,
}) => {
  const [prevPreselected, setPrevPreselected] = useState(preselectedDestination);
  const [destinationKey, setDestinationKey] = useState<string>(
    preselectedDestination || (destinations[0]?.destinationKey ?? 'mock')
  );

  if (preselectedDestination && preselectedDestination !== prevPreselected) {
    setPrevPreselected(preselectedDestination);
    setDestinationKey(preselectedDestination);
  }

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [tagsInput, setTagsInput] = useState('engineering, api, distribution');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey());
  const [isAsync, setIsAsync] = useState(false);

  // Form states
  const [submitting, setSubmitting] = useState(false);
  const [jobProgress, setJobProgress] = useState<Job | null>(null);
  const [error, setError] = useState<any>(null);
  const [successResult, setSuccessResult] = useState<PublishResult | null>(null);

  // Template loader helper
  const loadTemplate = (type: 'standard' | 'clean' | 'rule-trigger') => {
    if (type === 'standard') {
      setTitle('Exploring Scalable Long-Tail Content Syndication');
      setBody(
        '# Long-Tail Technical Syndication\n\n' +
        'Automated multi-platform distribution architectures require:\n\n' +
        '- **Deterministic idempotency** to prevent duplicated broadcasts.\n' +
        '- **Per-destination posting rules** to comply with community moderation standards.\n' +
        '- **Asynchronous threshold processing** for high-latency external APIs.\n'
      );
      setSummary('Architectural breakdown of modular content syndication for engineering teams.');
      setTagsInput('architecture, engineering, distribution');
      setCanonicalUrl('https://incubrix.internal/posts/syndication-architecture');
    } else if (type === 'clean') {
      setTitle('Continuous Connector Certification in Distributed Networks');
      setBody('Connector certification guarantees contract compliance across all supported platform endpoints.');
      setSummary('Overview of connector contract testing.');
      setTagsInput('testing, certification');
      setCanonicalUrl('');
    } else if (type === 'rule-trigger') {
      // Intentionally includes self-promotional terms or blocked content to demonstrate policy guard
      setTitle('FREE PROMO! Check out our new platform now!');
      setBody(
        'Sign up right now at http://spam.example.com/promo! Buy our products! ' +
        'Discount code: SPECIAL50. Click here: http://promo1.example.com http://promo2.example.com http://promo3.example.com'
      );
      setSummary('Super special promotional announcement.');
      setTagsInput('crypto, affiliate, promo');
      setCanonicalUrl('http://spam.example.com');
    }
    setError(null);
    setSuccessResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError({ message: "Field 'title' is required.", statusCode: 400 });
      return;
    }
    if (!body.trim()) {
      setError({ message: "Field 'body' is required.", statusCode: 400 });
      return;
    }
    if (!idempotencyKey.trim()) {
      setError({ message: "Header 'Idempotency-Key' is required.", statusCode: 400 });
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessResult(null);
    setJobProgress(null);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: PublishRequestBody = {
      content: {
        title: title.trim(),
        body: body.trim(),
        summary: summary.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        canonicalUrl: canonicalUrl.trim() || undefined,
      },
      simulate: true, // STRICTLY TRUE to prevent live publishing
      async: isAsync,
    };

    try {
      const response = await api.publish(destinationKey, idempotencyKey.trim(), payload);

      // Check if it's an asynchronous 202 queued job
      if ('jobId' in response && response.status === 'queued') {
        const jobId = response.jobId;
        setJobProgress({
          id: jobId,
          type: 'publish',
          destinationKey,
          status: 'queued',
          attempts: 0,
          maxAttempts: 3,
          queuedAt: new Date().toISOString(),
        });

        // Poll job until complete
        const finalJob = await api.pollJobUntilComplete(jobId, 800, 15000, (j) => {
          setJobProgress(j);
        });

        if (finalJob.status === 'succeeded' && finalJob.result) {
          const res = finalJob.result;
          setSuccessResult(res);
          const historyItem: PublicationHistoryItem = {
            id: `item-${Date.now()}`,
            idempotencyKey: idempotencyKey.trim(),
            destinationKey,
            title: title.trim(),
            bodySnippet: body.trim().slice(0, 80),
            submittedAt: new Date().toISOString(),
            status: res.decision === 'blocked' ? 'blocked' : 'success',
            statusCode: res.isCached ? 200 : 201,
            isCached: res.isCached,
            isSimulated: true,
            externalId: res.externalId,
            externalUrl: res.externalUrl,
            result: res,
            jobId,
          };
          onPublishComplete(historyItem);
        } else {
          throw new Error(finalJob.error?.message || 'Background publishing job failed.');
        }
      } else {
        // Synchronous 200/201 response
        const res = response as PublishResult;
        setSuccessResult(res);

        const historyItem: PublicationHistoryItem = {
          id: `item-${Date.now()}`,
          idempotencyKey: idempotencyKey.trim(),
          destinationKey,
          title: title.trim(),
          bodySnippet: body.trim().slice(0, 80),
          submittedAt: new Date().toISOString(),
          status: res.decision === 'blocked' ? 'blocked' : 'success',
          statusCode: res.isCached ? 200 : 201,
          isCached: res.isCached,
          isSimulated: true,
          externalId: res.externalId,
          externalUrl: res.externalUrl,
          result: res,
        };
        onPublishComplete(historyItem);
      }
    } catch (err: any) {
      if (err instanceof IncubrixApiError) {
        setError(err.apiError);
        const historyItem: PublicationHistoryItem = {
          id: `item-${Date.now()}`,
          idempotencyKey: idempotencyKey.trim(),
          destinationKey,
          title: title.trim(),
          bodySnippet: body.trim().slice(0, 80),
          submittedAt: new Date().toISOString(),
          status: err.apiError?.decision === 'blocked' ? 'blocked' : 'error',
          statusCode: err.statusCode,
          isSimulated: true,
          error: err.apiError,
        };
        onPublishComplete(historyItem);
      } else {
        setError({ message: err.message || 'An unexpected publishing error occurred.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SimulatorIcon size={24} style={{ color: 'var(--accent-primary)' }} />
          Publishing Simulator & Idempotency Testing
        </h2>
        <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Safely test content submission, destination posting rules validation, and idempotent replay against live backend connectors.
        </p>
      </div>

      {/* Safety Notice Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0.9rem 1.2rem',
          backgroundColor: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: 'var(--radius-lg)',
          color: '#38bdf8',
          fontSize: '0.84rem',
        }}
      >
        <ShieldIcon size={22} style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ fontWeight: 700 }}>Simulation & Dry-Run Mode Active:</strong> All submissions from this dashboard are
          automatically flagged with <code>simulate: true</code>. No actual content will be posted or syndicated to live external production channels.
        </div>
      </div>

      {/* Template Quick Selection */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-surface)',
          padding: '0.8rem 1.2rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          Load Test Template:
        </span>
        <button
          type="button"
          onClick={() => loadTemplate('standard')}
          style={{
            fontSize: '0.8rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          📄 Standard Technical Article
        </button>
        <button
          type="button"
          onClick={() => loadTemplate('clean')}
          style={{
            fontSize: '0.8rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-surface-elevated)',
            color: 'var(--text-main)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          ✨ Concise Contract Post
        </button>
        <button
          type="button"
          onClick={() => loadTemplate('rule-trigger')}
          style={{
            fontSize: '0.8rem',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}
        >
          ⚠️ Rule-Violation Sample (Triggers Policy Block)
        </button>
      </div>

      {/* Main Publishing Form */}
      <Card glow={submitting}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {/* Destination Selector & Async Mode Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Target Destination Connector *
              </label>
              <select
                value={destinationKey}
                onChange={(e) => setDestinationKey(e.target.value)}
                required
              >
                {destinations.map((d) => (
                  <option key={d.destinationKey} value={d.destinationKey}>
                    [{d.destinationKey}] {d.name} {d.rulesConfigured ? '(Rules Configured)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Execution Mode
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '0.65rem 0.9rem',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  height: '42px',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
                  <input
                    type="checkbox"
                    checked={isAsync}
                    onChange={(e) => setIsAsync(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                  <span>Queue as Async Background Job (HTTP 202)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Idempotency Key Row */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Idempotency-Key Header (Required) *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {lastUsedIdempotencyKey && (
                  <button
                    type="button"
                    onClick={() => setIdempotencyKey(lastUsedIdempotencyKey)}
                    style={{ fontSize: '0.74rem', color: '#c084fc', textDecoration: 'underline' }}
                  >
                    Replay Last Key
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(generateIdempotencyKey())}
                  style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshIcon size={11} /> Generate New Key
                </button>
              </div>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              required
              placeholder="e.g. pub-17928723-a1b2c3d4"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a5b4fc' }}
            />
            <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '4px' }}>
              Submitting the exact same payload with an identical key will return a cached idempotent response (HTTP 200).
            </p>
          </div>

          {/* Post Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Content Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Distributed Publishing Architecture on IncuBrix"
              required
            />
          </div>

          {/* Post Body */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Content Body (Markdown or Plain Text) *
              </label>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                {body.length} characters
              </span>
            </div>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter markdown or plain text post content here..."
              required
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.86rem', lineHeight: 1.5 }}
            />
          </div>

          {/* Optional Metadata Row: Summary, Tags, Canonical URL */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Summary / Excerpt (Optional)
              </label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief synopsis..."
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Tags (Comma-Separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="tag1, tag2, tag3"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Canonical URL (Optional)
              </label>
              <input
                type="url"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://example.com/original-article"
              />
            </div>
          </div>

          {/* Error and Progress Displays */}
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          {jobProgress && (
            <div
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                  borderTopColor: 'var(--accent-primary)',
                }}
                className="animate-spin"
              />
              <div style={{ fontSize: '0.86rem' }}>
                <strong style={{ color: 'var(--accent-primary)' }}>Asynchronous Job Queued:</strong> [
                <code>{jobProgress.id}</code>] Status: <strong>{jobProgress.status.toUpperCase()}</strong> (polling
                backend at <code>/api/v1/jobs/{jobProgress.id}</code>...)
              </div>
            </div>
          )}

          {successResult && (
            <div
              style={{
                backgroundColor: successResult.decision === 'blocked' ? 'var(--status-warning-bg)' : 'var(--status-success-bg)',
                border: `1px solid ${successResult.decision === 'blocked' ? 'var(--status-warning-border)' : 'var(--status-success-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircleIcon size={20} style={{ color: successResult.decision === 'blocked' ? '#fbbf24' : '#34d399' }} />
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Publication Completed:{' '}
                    <span style={{ textTransform: 'uppercase' }}>{successResult.decision}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Status: <code>{successResult.status}</code> | ID: <code>{successResult.externalId || 'N/A'}</code> |{' '}
                    {successResult.isCached ? 'CACHED IDEMPOTENT REPLAY' : 'FRESH EXECUTION'}
                  </div>
                </div>
              </div>
              <StatusBadge
                label={successResult.isCached ? 'CACHED REPLAY (200)' : 'NEW EXECUTION (201)'}
                variant={successResult.isCached ? 'purple' : 'success'}
              />
            </div>
          )}

          {/* Submit Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '0.5rem' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.75rem 1.6rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--accent-gradient)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.92rem',
                boxShadow: 'var(--shadow-glow)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? (
                <>
                  <RefreshIcon size={16} className="animate-spin" /> Submitting to Engine...
                </>
              ) : (
                <>
                  <PlayIcon size={16} /> Execute Publish Simulator
                </>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
};
