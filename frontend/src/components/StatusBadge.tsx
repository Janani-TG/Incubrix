import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'purple'
  | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string }> = {
    success: {
      bg: 'rgba(16, 185, 129, 0.12)',
      text: '#34d399',
      border: 'rgba(16, 185, 129, 0.3)',
      dotColor: '#10b981',
    },
    error: {
      bg: 'rgba(239, 68, 68, 0.12)',
      text: '#f87171',
      border: 'rgba(239, 68, 68, 0.3)',
      dotColor: '#ef4444',
    },
    warning: {
      bg: 'rgba(245, 158, 11, 0.12)',
      text: '#fbbf24',
      border: 'rgba(245, 158, 11, 0.3)',
      dotColor: '#f59e0b',
    },
    info: {
      bg: 'rgba(56, 189, 248, 0.12)',
      text: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.3)',
      dotColor: '#0284c7',
    },
    purple: {
      bg: 'rgba(168, 85, 247, 0.12)',
      text: '#c084fc',
      border: 'rgba(168, 85, 247, 0.3)',
      dotColor: '#a855f7',
    },
    neutral: {
      bg: 'rgba(148, 163, 184, 0.1)',
      text: '#94a3b8',
      border: 'rgba(148, 163, 184, 0.2)',
      dotColor: '#64748b',
    },
  };

  const style = variantStyles[variant];
  const sizeStyles = size === 'sm' ? { padding: '2px 8px', fontSize: '0.72rem' } : { padding: '4px 11px', fontSize: '0.8rem' };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        lineHeight: 1.2,
        ...sizeStyles,
      }}
    >
      {dot && (
        <span
          style={{
            width: size === 'sm' ? 5 : 7,
            height: size === 'sm' ? 5 : 7,
            borderRadius: '50%',
            backgroundColor: style.dotColor,
            boxShadow: `0 0 6px ${style.dotColor}`,
          }}
        />
      )}
      {label}
    </span>
  );
};
