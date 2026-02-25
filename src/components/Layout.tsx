import { LayoutDashboard, List, BarChart3, Receipt, FlaskConical, Settings, Eye } from 'lucide-react';
import { PortfolioSelector } from './PortfolioSelector';
import type { TabId } from '../types';

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onSettingsClick?: () => void;
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

export function Layout({ activeTab, onTabChange, onSettingsClick, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-surface pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-surface-card border-b border-b-default sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-t-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            Wealth Tracker
          </h1>
          <div className="flex items-center gap-1">
            {/* Desktop tabs */}
            <nav className="hidden md:flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                    ${
                      activeTab === tab.id
                        ? 'bg-accent-light text-accent'
                        : 'text-t-muted hover:bg-surface-alt'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                className="p-2 hover:bg-surface-alt rounded-lg transition-colors ml-1"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-t-muted" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Portfolio Selector */}
      <div className="max-w-6xl mx-auto px-4 pt-3">
        <PortfolioSelector />
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-4">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-card border-t border-b-default z-30">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors
                ${
                  activeTab === tab.id
                    ? 'text-accent'
                    : 'text-t-muted'
                }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
