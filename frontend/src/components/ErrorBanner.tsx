import React from 'react';
import { AlertTriangleIcon, CrossIcon, RefreshIcon } from './Icons';
import type { ApiError } from '../types/api';

interface ErrorBannerProps {
  error: ApiError | string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  title?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onRetry,
  onDismiss,
  title = 'API Operation Error',
}) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const statusCode = typeof error === 'object' && error !== null ? error.statusCode : undefined;
  const errorType = typeof error === 'object' && error !== null ? error.error : undefined;
  const violations = typeof error === 'object' && error !== null ? error.violations : undefined;

  return (
    <div
      style={{
        backgroundColor: 'var(--status-error-bg)',
        border: '1px solid var(--status-error-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1rem 1.2rem',
        margin: '1rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangleIcon size={18} style={{ color: 'var(--status-error)' }} />
          <h4 style={{ color: '#fca5a5', fontSize: '0.92rem', fontWeight: 700 }}>
            {title}
            {statusCode ? ` (HTTP ${statusCode}${errorType ? `: ${errorType}` : ''})` : ''}
          </h4>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem',
                color: '#fca5a5',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
              }}
            >
              <RefreshIcon size={12} /> Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                color: 'var(--text-dim)',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Dismiss"
            >
              <CrossIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <p style={{ color: '#fecaca', fontSize: '0.85rem', lineHeight: 1.45 }}>
        {errorMessage}
      </p>

      {violations && violations.length > 0 && (
        <div
          style={{
            marginTop: '0.4rem',
            padding: '0.6rem 0.8rem',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
          }}
        >
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f87171', marginBottom: '4px' }}>
            Policy Rule Violations Detected:
          </div>
          <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.8rem', color: '#fecaca' }}>
            {violations.map((v, idx) => (
              <li key={idx} style={{ marginBottom: '2px' }}>
                <strong style={{ color: '#f87171' }}>[{v.ruleId}]</strong> {v.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
