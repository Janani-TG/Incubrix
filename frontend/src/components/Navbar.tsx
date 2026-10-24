import React from 'react';
import {
  DashboardIcon,
  DestinationsIcon,
  SimulatorIcon,
  ResultsIcon,
  CertificationIcon,
  ShieldIcon,
  ServerIcon,
  RefreshIcon,
} from './Icons';
import type { HealthResponse } from '../types/api';

export type NavTab = 'overview' | 'destinations' | 'simulator' | 'results' | 'certification';

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  health: HealthResponse | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  backendUrl: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  health,
  healthLoading,
  onRefreshHealth,
  backendUrl,
}) => {
  const isHealthy = health?.status === 'ok';

  const navItems: { key: NavTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <DashboardIcon size={18} /> },
    { key: 'destinations', label: 'Destinations', icon: <DestinationsIcon size={18} /> },
    { key: 'simulator', label: 'Publish Simulator', icon: <SimulatorIcon size={18} /> },
    { key: 'results', label: 'Results & Logs', icon: <ResultsIcon size={18} /> },
    { key: 'certification', label: 'Certification', icon: <CertificationIcon size={18} /> },
  ];

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-surface-glass)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 1.5rem',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 0',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Brand Logo & Tagline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <ServerIcon size={20} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  IncuBrix
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--accent-primary)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    letterSpacing: '0.05em',
                  }}
                >
                  DISTRIBUTION ENGINE
                </span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '1px' }}>
                Long-Tail Syndication, Policy Guard & Reliability Harness
              </p>
            </div>
          </div>

          {/* Right Status Indicators & Live Health Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Simulation Safety Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                fontSize: '0.74rem',
                fontWeight: 600,
                color: '#38bdf8',
              }}
              title="Simulation & Dry-Run is strictly enforced on all UI interactions. No live platforms will be published to."
            >
              <ShieldIcon size={14} style={{ color: '#38bdf8' }} />
              <span>SIMULATION ACTIVE</span>
            </div>

            {/* Backend URL & Status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.8rem',
              }}
            >
              <span
                className={`pulse-dot ${isHealthy ? 'online' : health ? 'warning' : 'offline'}`}
                title={isHealthy ? 'Connected to backend' : 'Backend offline or error'}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Backend:</span>
              <code style={{ color: 'var(--text-main)', fontSize: '0.76rem', fontWeight: 600 }}>
                {backendUrl}
              </code>
              <button
                onClick={onRefreshHealth}
                disabled={healthLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  color: 'var(--text-dim)',
                  borderRadius: '4px',
                }}
                title="Ping backend health (/health)"
              >
                <RefreshIcon size={14} className={healthLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Navigation Items */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.4rem 0',
            overflowX: 'auto',
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onTabChange(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.55rem 1rem',
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                  boxShadow: isActive ? '0 0 15px -3px rgba(99, 102, 241, 0.3)' : 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-dim)' }}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
