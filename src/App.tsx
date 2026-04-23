import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { PortfolioProvider, usePortfolioContext } from './context/PortfolioContext';
import { Layout } from './components/Layout';
import { SettingsModal } from './components/SettingsModal';
import { Dashboard } from './components/Dashboard';
import { HoldingsTable } from './components/HoldingsTable';
import { Charts } from './components/Charts';
import { TransactionLog } from './components/TransactionLog';
import { Simulator } from './components/Simulator';
import { Watchlist } from './components/Watchlist';
import { FirePage } from './components/FirePage';
import { WelcomeScreen } from './components/WelcomeScreen';
import { PreUpdateNagModal } from './components/PreUpdateNagModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAutoBackup } from './hooks/useAutoBackup';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { readAppMeta, updateAppMeta } from './data/schema';
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

  // Pre-update nag: shown exactly once per app version change. Only runs
  // if the user has existing data (so fresh installs aren't nagged).
  const currentAppVersion = import.meta.env.APP_VERSION;
  const [showPreUpdateNag, setShowPreUpdateNag] = useState<{ storedVersion: string | null } | null>(() => {
    const meta = readAppMeta();
    const hasExistingData = !!localStorage.getItem('portfolio-holdings');
    if (!hasExistingData) {
      // Fresh install — nothing to back up; stamp current version silently
      updateAppMeta({ lastAppVersion: currentAppVersion, preUpdateAckVersion: currentAppVersion });
      return null;
    }
    const alreadyAcked = meta.preUpdateAckVersion === currentAppVersion;
    if (alreadyAcked) return null;
    return { storedVersion: meta.lastAppVersion };
  });
  useEffect(() => {
    // If we decided not to nag, still keep lastAppVersion fresh
    if (!showPreUpdateNag) {
      const meta = readAppMeta();
      if (meta.lastAppVersion !== currentAppVersion) {
        updateAppMeta({ lastAppVersion: currentAppVersion });
      }
    }
  }, [showPreUpdateNag, currentAppVersion]);

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
  const isOnline = useOnlineStatus();

  if (showPreUpdateNag) {
    return (
      <PreUpdateNagModal
        currentAppVersion={currentAppVersion}
        storedAppVersion={showPreUpdateNag.storedVersion}
        onAcknowledged={() => setShowPreUpdateNag(null)}
      />
    );
  }

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
      {!isOnline && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          You're offline — prices may be stale
        </div>
      )}
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
      {activeTab === 'fire' && <FirePage />}
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
