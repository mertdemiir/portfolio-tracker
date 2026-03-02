import { LayoutDashboard, List, BarChart3, Receipt, FlaskConical, Settings, Eye } from 'lucide-react';
import { PortfolioSelector } from './PortfolioSelector';
import type { TabId } from '../types';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSettingsClick?: () => void;
  latestPriceUpdate?: number;
  children: React.ReactNode;
}

const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'holdings', label: 'Holdings', icon: List },
  { id: 'charts', label: 'Charts', icon: BarChart3 },
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'simulator', label: 'Simulator', icon: FlaskConical },
  { id: 'watchlist', label: 'Watchlist', icon: Eye },
];

function formatAsOf(timestamp: number): { text: string; stale: boolean } {
  if (!timestamp) return { text: '', stale: false };
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const stale = diffHr >= 24;
  if (diffMin < 1) return { text: 'just now', stale };
  if (diffMin < 60) return { text: `${diffMin}m ago`, stale };
  if (diffHr < 24) return { text: `${diffHr}h ago`, stale };
  return { text: `${Math.floor(diffHr / 24)}d ago`, stale: true };
}

export function Layout({ activeTab, onTabChange, onSettingsClick, latestPriceUpdate, children }: LayoutProps) {
  const asOf = latestPriceUpdate ? formatAsOf(latestPriceUpdate) : null;
  return (
    <div className="min-h-screen bg-surface pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-surface-card/80 backdrop-blur-xl border-b border-b-default/50 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <h1 className="text-base font-bold text-t-primary flex items-center gap-2 tracking-tight">
            <BarChart3 className="w-5 h-5 text-accent" />
            Wealth Tracker
          </h1>
          <div className="flex items-center">
            {/* Desktop tabs */}
            <nav className="hidden md:flex items-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`relative px-3 py-4 text-[13px] font-medium transition-colors flex items-center gap-1.5
                    ${
                      activeTab === tab.id
                        ? 'text-accent'
                        : 'text-t-muted hover:text-t-secondary'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-accent rounded-full" />
                  )}
                </button>
              ))}
            </nav>
            {asOf && asOf.text && (
              <span className={`hidden md:inline text-[11px] tabular-nums ml-3 ${asOf.stale ? 'text-amber-500' : 'text-t-faint'}`} title={`Prices updated ${asOf.text}`}>
                {asOf.stale ? '⚠ ' : ''}as of {asOf.text}
              </span>
            )}
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-2 hover:bg-surface-alt rounded-lg transition-colors ml-2"
                title="Settings"
              >
                <Settings className="w-[18px] h-[18px] text-t-muted" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Portfolio Selector */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3">
        <PortfolioSelector />
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-card/90 backdrop-blur-lg border-t border-b-default/50 z-30">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'text-accent'
                    : 'text-t-faint'
                }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'stroke-[2.5]' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
