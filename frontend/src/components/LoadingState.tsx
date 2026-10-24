import React from 'react';
import { RefreshIcon } from './Icons';

interface LoadingStateProps {
  message?: string;
  minHeight?: string | number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading live data from IncuBrix engine...',
  minHeight = '180px',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight,
        gap: '12px',
        color: 'var(--text-muted)',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        className="animate-spin"
      >
        <RefreshIcon size={18} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />
      </div>
      <p style={{ fontSize: '0.88rem', fontWeight: 500, letterSpacing: '0.01em' }}>
        {message}
      </p>
    </div>
  );
};
