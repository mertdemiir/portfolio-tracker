import { useState } from 'react';
import { PortfolioProvider, usePortfolioContext } from './context/PortfolioContext';
import { Layout } from './components/Layout';
import { SettingsModal } from './components/SettingsModal';
import { Dashboard } from './components/Dashboard';
import { HoldingsTable } from './components/HoldingsTable';
import { Charts } from './components/Charts';
import { TransactionLog } from './components/TransactionLog';
import { Simulator } from './components/Simulator';
import { Watchlist } from './components/Watchlist';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAutoBackup } from './hooks/useAutoBackup';
import type { TabId } from './types';

export interface NavFilter {
  ticker?: string;
  category?: string;
}

function AppContent() {
  const {
    apiKey,
    setApiKey,
    priceError,
    customCategories,
    addCustomCategory,
    deleteCustomCategory,
    priceCache,
  } = usePortfolioContext();
  const [activeTab, setActiveTab] = useState<TabId>('holdings');
  const [showSettings, setShowSettings] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useLocalStorage('welcome-dismissed', false);
  const [navFilter, setNavFilter] = useState<NavFilter | null>(null);

  function navigateTo(tab: TabId, filter?: NavFilter) {
    setNavFilter(filter || null);
    setActiveTab(tab);
  }

  function handleTabChange(tab: TabId) {
    setNavFilter(null);
    setActiveTab(tab);
  }

  // Compute most recent price update for "as of" timestamp
  const latestPriceUpdate = Object.values(priceCache).reduce((latest, q) => {
    return q.lastUpdated > latest ? q.lastUpdated : latest;
  }, 0);

  // Auto-backup scheduling (Electron only, runs silently)
  useAutoBackup();

  if (!welcomeDismissed && !apiKey) {
    return (
      <WelcomeScreen
        onSaveKey={(key) => {
          setApiKey(key);
          setWelcomeDismissed(true);
        }}
        onSkip={() => setWelcomeDismissed(true)}
      />
    );
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange} onSettingsClick={() => setShowSettings(true)} latestPriceUpdate={latestPriceUpdate}>
      {priceError && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          {priceError}
        </div>
      )}
      {activeTab === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
      {activeTab === 'holdings' && <HoldingsTable initialFilter={navFilter} onNavigate={navigateTo} />}
      {activeTab === 'charts' && <Charts />}
      {activeTab === 'transactions' && <TransactionLog initialFilter={navFilter} />}
      {activeTab === 'simulator' && <Simulator />}
      {activeTab === 'watchlist' && <Watchlist />}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          onSaveApiKey={setApiKey}
          customCategories={customCategories}
          onAddCategory={addCustomCategory}
          onDeleteCategory={deleteCustomCategory}
          onClose={() => setShowSettings(false)}
        />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <PortfolioProvider>
      <AppContent />
    </PortfolioProvider>
  );
}
