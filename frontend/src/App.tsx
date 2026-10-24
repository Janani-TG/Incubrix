import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, type NavTab } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { DestinationsPage } from './pages/DestinationsPage';
import { PublishSimulatorPage } from './pages/PublishSimulatorPage';
import { ResultsPage } from './pages/ResultsPage';
import { CertificationPage } from './pages/CertificationPage';
import type {
  HealthResponse,
  DestinationSummary,
  PublicationHistoryItem,
} from './types/api';
import { api } from './services/api';

const HISTORY_STORAGE_KEY = 'incubrix_simulation_history_v1';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const [destinationsLoading, setDestinationsLoading] = useState(false);
  const [destinationsError, setDestinationsError] = useState<string | null>(null);

  // Simulator navigation helpers
  const [preselectedDest, setPreselectedDest] = useState<string | undefined>(undefined);
  const [lastUsedIdempotencyKey, setLastUsedIdempotencyKey] = useState<string | undefined>(undefined);

  // Publication history
  const [history, setHistory] = useState<PublicationHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore localStorage errors
    }
  }, [history]);

  // Fetch health
  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Fetch destinations
  const refreshDestinations = useCallback(async () => {
    setDestinationsLoading(true);
    setDestinationsError(null);
    try {
      const data = await api.getDestinations();
      setDestinations(data.destinations || []);
    } catch (err: any) {
      setDestinationsError(err.message || 'Failed to load destinations from /api/v1/destinations');
    } finally {
      setDestinationsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let active = true;
    const init = async () => {
      setHealthLoading(true);
      try {
        const h = await api.getHealth();
        if (active) setHealth(h);
      } catch {
        if (active) setHealth(null);
      } finally {
        if (active) setHealthLoading(false);
      }

      setDestinationsLoading(true);
      try {
        const d = await api.getDestinations();
        if (active) setDestinations(d.destinations || []);
      } catch (err: any) {
        if (active) setDestinationsError(err.message || 'Failed to load destinations');
      } finally {
        if (active) setDestinationsLoading(false);
      }
    };

    init();
    const interval = setInterval(refreshHealth, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshHealth]);

  // Handle new publication completed
  const handlePublishComplete = (newItem: PublicationHistoryItem) => {
    setHistory((prev) => [newItem, ...prev]);
    setLastUsedIdempotencyKey(newItem.idempotencyKey);
  };

  // Select destination from destinations page to simulate
  const handleSelectForPublish = (destKey: string) => {
    setPreselectedDest(destKey);
    setActiveTab('simulator');
  };

  // Replay an existing item
  const handleReplay = (item: PublicationHistoryItem) => {
    setPreselectedDest(item.destinationKey);
    setLastUsedIdempotencyKey(item.idempotencyKey);
    setActiveTab('simulator');
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleRefreshAll = () => {
    refreshHealth();
    refreshDestinations();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        health={health}
        healthLoading={healthLoading}
        onRefreshHealth={refreshHealth}
        backendUrl={api.getBaseUrl()}
      />

      {/* Main Page Body */}
      <main
        style={{
          flex: 1,
          maxWidth: '1400px',
          width: '100%',
          margin: '0 auto',
          padding: '1.8rem 1.5rem 3rem 1.5rem',
        }}
      >
        {activeTab === 'overview' && (
          <OverviewPage
            health={health}
            healthLoading={healthLoading}
            destinations={destinations}
            destinationsLoading={destinationsLoading}
            history={history}
            onNavigate={setActiveTab}
            onRefreshAll={handleRefreshAll}
          />
        )}

        {activeTab === 'destinations' && (
          <DestinationsPage
            destinations={destinations}
            loading={destinationsLoading}
            error={destinationsError}
            onRefresh={refreshDestinations}
            onSelectForPublish={handleSelectForPublish}
          />
        )}

        {activeTab === 'simulator' && (
          <PublishSimulatorPage
            destinations={destinations}
            preselectedDestination={preselectedDest}
            onPublishComplete={handlePublishComplete}
            lastUsedIdempotencyKey={lastUsedIdempotencyKey}
          />
        )}

        {activeTab === 'results' && (
          <ResultsPage
            history={history}
            onClearHistory={handleClearHistory}
            onReplay={handleReplay}
            onNavigateToSimulator={() => setActiveTab('simulator')}
          />
        )}

        {activeTab === 'certification' && (
          <CertificationPage destinations={destinations} />
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '1.2rem 1.5rem',
          fontSize: '0.82rem',
          color: 'var(--text-dim)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
          <div>
            <strong>IncuBrix Long-Tail Distribution Network</strong> — Safe Dry-Run Dashboard
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Backend: <code>http://localhost:3000</code></span>
            <span>API Prefix: <code>/api/v1</code></span>
            <span>Mode: <code>Simulated / Mock Isolation</code></span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
