import { useState, useRef } from 'react';
import { Trash2, Plus, Key, Tag, Download, Upload, HardDrive, FileSpreadsheet, Sun, Moon, Stars, BarChart3, FolderOpen, Landmark, TerminalSquare, Database, Receipt } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useSettings } from '../context/SettingsContext';
import { usePricesFx } from '../context/PricesFxContext';
import { useAutoBackup } from '../hooks/useAutoBackup';
import { CsvImportModal } from './CsvImportModal';
import { ManagePortfoliosModal } from './ManagePortfoliosModal';
import { gatherBackupData, parseBackup, serializeBackup } from '../data/backup';
import { updateAppMeta, readAppMeta } from '../data/schema';
import { switchBackend } from '../data/store/backendSwitch';
import { getAdapter, writeCached } from '../data/store/hydration';
import { isManagedStoreKey } from '../data/store/types';
import { notifyStorageRefresh } from '../hooks/useLocalStorage';
import { formatMonthYear } from '../utils/dateHelpers';
import type { CustomCategory, ThemeId, BenchmarkId } from '../types';
import { BENCHMARK_CONFIG, ACCENT_PRESETS, SUPPORTED_CURRENCIES } from '../types';

interface SettingsModalProps {
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  customCategories: CustomCategory[];
  onAddCategory: (label: string) => void;
  onDeleteCategory: (key: string) => void;
  onClose: () => void;
}

export function SettingsModal({
  apiKey,
  onSaveApiKey,
  customCategories,
  onAddCategory,
  onDeleteCategory,
  onClose,
}: SettingsModalProps) {
  const { holdings, snapshots, ledgerDivergences } = usePortfolioContext();
  const { theme, themePreference, setTheme, accentColor, setAccentColor, baseCurrency, setBaseCurrency, useTxnSourceOfTruth, setUseTxnSourceOfTruth } = useSettings();
  const { importBenchmarkCsv, clearBenchmark, getBenchmarkDateRange } = usePricesFx();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showManagePortfolios, setShowManagePortfolios] = useState(false);
  const [benchmarkStatus, setBenchmarkStatus] = useState<Record<string, string>>({});
  const benchmarkFileRefs = useRef<Record<string, HTMLInputElement | null>>({ spx: null, btc: null, gold: null });
  const { settings: autoBackupSettings, setEnabled: setAutoEnabled, setFrequency: setAutoFrequency, chooseFolder: chooseAutoFolder } = useAutoBackup();

  // Storage backend switch state
  const [currentBackend, setCurrentBackend] = useState(() => readAppMeta().dataBackend);
  const [switching, setSwitching] = useState(false);
  const [switchStatus, setSwitchStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  async function handleSwitchBackend(target: 'localStorage' | 'indexedDB') {
    if (target === currentBackend) return;
    const confirmMsg =
      `This will copy your portfolio data from ${currentBackend} to ${target}. ` +
      `A backup file will be saved first. After the copy succeeds, the app will reload.` +
      `\n\nYour original data in ${currentBackend} is left intact so you can roll back anytime.`;
    if (!window.confirm(confirmMsg)) return;

    setSwitching(true);
    setSwitchStatus(null);
    try {
      const result = await switchBackend(target, { backup: 'required', source: getAdapter() });
      if (result.ok) {
        setSwitchStatus({ kind: 'success', message: result.message });
        // Give the user a moment to read the message, then reload
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setSwitchStatus({ kind: 'error', message: result.message });
      }
    } catch (err) {
      setSwitchStatus({
        kind: 'error',
        message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSwitching(false);
      setCurrentBackend(readAppMeta().dataBackend);
    }
  }

  const isElectron = !!window.electronAPI;

  function handleSaveKey() {
    const trimmed = keyInput.trim();
    if (trimmed) {
      onSaveApiKey(trimmed);
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    }
  }

  function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const label = newCategoryLabel.trim();
    if (label) {
      onAddCategory(label);
      setNewCategoryLabel('');
    }
  }

  async function handleBenchmarkImport(key: BenchmarkId) {
    let csvText: string | null = null;

    if (isElectron) {
      const result = await window.electronAPI!.importCsv();
      if (result.cancelled || !result.success) {
        if (result.error) setBenchmarkStatus((s) => ({ ...s, [key]: `Error: ${result.error}` }));
        return;
      }
      csvText = result.data!;
    } else {
      // Browser fallback: use hidden file input
      const input = benchmarkFileRefs.current[key];
      if (!input) return;
      input.value = '';
      input.click();
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
      });
      if (!file) return;
      csvText = await file.text();
    }

    const result = importBenchmarkCsv(key, csvText!);
    if (result.success) {
      setBenchmarkStatus((s) => ({ ...s, [key]: `Imported ${result.count} data points` }));
    } else {
      setBenchmarkStatus((s) => ({ ...s, [key]: result.error || 'Import failed' }));
    }
    setTimeout(() => setBenchmarkStatus((s) => ({ ...s, [key]: '' })), 3000);
  }

  function handleBenchmarkClear(key: BenchmarkId) {
    if (!confirm(`Clear all ${BENCHMARK_CONFIG[key].label} data?`)) return;
    clearBenchmark(key);
    setBenchmarkStatus((s) => ({ ...s, [key]: 'Data cleared' }));
    setTimeout(() => setBenchmarkStatus((s) => ({ ...s, [key]: '' })), 2000);
  }

  async function handleExport() {
    const payload = serializeBackup(gatherBackupData('manual'));
    if (isElectron) {
      const result = await window.electronAPI!.exportData(payload);
      if (result.success) {
        updateAppMeta({ lastBackupAt: new Date().toISOString() });
        setBackupStatus('Backup saved!');
      } else if (!result.cancelled) {
        setBackupStatus(`Export failed: ${result.error}`);
      }
    } else {
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      updateAppMeta({ lastBackupAt: new Date().toISOString() });
      setBackupStatus('Backup downloaded!');
    }
    setTimeout(() => setBackupStatus(null), 3000);
  }

  async function handleImport() {
    let jsonString: string | null = null;

    if (isElectron) {
      const result = await window.electronAPI!.importData();
      if (result.cancelled || !result.success) {
        if (result.error) setBackupStatus(`Import failed: ${result.error}`);
        return;
      }
      jsonString = result.data!;
    } else {
      // Browser fallback: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return;
      jsonString = await file.text();
    }

    try {
      const backup = parseBackup(jsonString!);
      if (!backup.holdings || !backup.snapshots) {
        setBackupStatus('Invalid backup file: missing holdings or snapshots.');
        setTimeout(() => setBackupStatus(null), 3000);
        return;
      }
      if (!confirm('This will replace ALL your current data with the backup. Continue?')) return;

      /**
       * Helper for the Phase 5.1 backup-import flow.
       *
       * Routes the value to the right storage layer (hydration cache for
       * managed keys, raw localStorage for everything else) and then fires
       * a same-tab refresh signal so all useLocalStorage subscribers for
       * this key re-read. Eliminates the page reload that previously
       * concluded the import.
       */
      const writeKey = (key: string, value: unknown) => {
        if (isManagedStoreKey(key)) {
          writeCached(key, value);
        } else {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch {
            // Storage full / disabled — non-fatal for the rest of the import.
          }
        }
        notifyStorageRefresh(key);
      };

      writeKey('portfolio-holdings', backup.holdings);
      writeKey('portfolio-snapshots', backup.snapshots);
      if (backup.customCategories) writeKey('custom-categories', backup.customCategories);
      if (backup.apiKey) writeKey('finnhub-api-key', backup.apiKey);
      if (backup.transactions) writeKey('transactions', backup.transactions);
      if (backup.targetAllocations) writeKey('target-allocations', backup.targetAllocations);
      if (backup.nwTarget !== undefined) writeKey('nw-target', backup.nwTarget);
      if (backup.nwMilestones) writeKey('nw-milestones', backup.nwMilestones);
      if (backup.benchmarkDataSpx) writeKey('benchmark-data-spx', backup.benchmarkDataSpx);
      if (backup.benchmarkDataBtc) writeKey('benchmark-data-btc', backup.benchmarkDataBtc);
      if (backup.benchmarkDataGold) writeKey('benchmark-data-gold', backup.benchmarkDataGold);
      if (backup.accentColor) writeKey('accent-color', backup.accentColor);
      if (backup.watchlistItems) writeKey('watchlist-items', backup.watchlistItems);
      if (backup.holdingOrder) writeKey('holding-order', backup.holdingOrder);
      if (backup.baseCurrency) writeKey('base-currency', backup.baseCurrency);
      if (backup.portfolios) writeKey('portfolios', backup.portfolios);
      if (backup.liabilities) writeKey('liabilities', backup.liabilities);
      if (backup.annotations) writeKey('timeline-annotations', backup.annotations);
      if (backup.theme) writeKey('theme', backup.theme);
      if (backup.benchmarkEnabled) writeKey('benchmark-enabled', backup.benchmarkEnabled);

      setBackupStatus('Backup imported.');
      setTimeout(() => setBackupStatus(null), 2500);
    } catch {
      setBackupStatus('Failed to parse backup file.');
      setTimeout(() => setBackupStatus(null), 3000);
    }
  }

  return (
    <>
      <Modal title="Settings" onClose={onClose} size="xl">
        {/* Appearance Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <Sun className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Appearance</h3>
          </div>

          {/* Auto Appearance Toggle */}
          <div className="flex items-center justify-between py-2.5 px-3 bg-surface rounded-lg mb-3">
            <div>
              <p className="text-sm font-medium text-t-secondary">Automatic Appearance</p>
              <p className="text-xs text-t-muted">Light during day · Dark at night</p>
            </div>
            <button
              type="button"
              onClick={() => setTheme(themePreference === 'auto' ? theme : 'auto')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                themePreference === 'auto' ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-surface-card transition-transform ${
                themePreference === 'auto' ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {([
              { id: 'heritage' as ThemeId, label: 'Heritage', icon: Landmark, bg: '#f4f1ec', card: '#f9f7f4', text: '#1a1612' },
              { id: 'terminal' as ThemeId, label: 'Terminal', icon: TerminalSquare, bg: '#0a0a0a', card: '#111111', text: '#00ff88' },
              { id: 'light' as ThemeId, label: 'Light', icon: Sun, bg: '#f9fafb', card: '#ffffff', text: '#111827' },
              { id: 'dark' as ThemeId, label: 'Dark', icon: Moon, bg: '#0c0f1a', card: '#151926', text: '#f0f2f5' },
              { id: 'midnight' as ThemeId, label: 'Midnight', icon: Stars, bg: '#050509', card: '#0d0d14', text: '#f0f2f5' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                  themePreference === t.id || (themePreference === 'auto' && theme === t.id)
                    ? 'border-accent ring-1 ring-accent/30'
                    : 'border-b-default hover:border-b-input'
                }`}
              >
                <div
                  className="w-full h-8 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: t.bg }}
                >
                  <div className="w-6 h-3 rounded" style={{ backgroundColor: t.card }} />
                </div>
                <div className="flex items-center gap-1">
                  <t.icon className="w-3.5 h-3.5 text-t-muted" />
                  <span className="text-xs font-medium text-t-secondary">{t.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Accent Color */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-t-muted mb-2">Accent Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {ACCENT_PRESETS.map((p) => (
                <button
                  key={p.color}
                  onClick={() => setAccentColor(p.color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    accentColor === p.color ? 'border-t-primary scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                />
              ))}
              <label className="relative w-8 h-8 rounded-full border-2 border-dashed border-b-input cursor-pointer hover:border-b-default transition-colors overflow-hidden" title="Custom color">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Plus className="w-3.5 h-3.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-t-faint" />
              </label>
            </div>
          </div>

          {/* Base Currency */}
          <div className="mt-3">
            <label className="block text-xs font-medium text-t-muted mb-2">Base Currency</label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code} – {c.name}</option>
              ))}
            </select>
            <p className="text-xs text-t-faint mt-1">All values will be converted to this currency.</p>
          </div>
        </div>

        {/* API Key Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <Key className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Finnhub API Key</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Enter your Finnhub API key"
              className="flex-1 px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <button
              onClick={handleSaveKey}
              disabled={!keyInput.trim()}
              className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {keySaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-t-faint mt-1.5">
            Required for live stock & ETF prices.
          </p>
        </div>

        {/* Custom Categories Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <Tag className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Custom Categories</h3>
          </div>

          {customCategories.length > 0 ? (
            <div className="space-y-2 mb-3">
              {customCategories.map((cat) => (
                <div
                  key={cat.key}
                  className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg"
                >
                  <span className="text-sm text-t-secondary">{cat.label}</span>
                  <button
                    onClick={() => onDeleteCategory(cat.key)}
                    className="p-1 hover:bg-loss-bg rounded transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-t-faint hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-t-faint mb-3">No custom categories yet.</p>
          )}

          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              placeholder="New category name"
              className="flex-1 px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
            />
            <button
              type="submit"
              disabled={!newCategoryLabel.trim()}
              className="inline-flex items-center gap-1 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>

        {/* Benchmark Data Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <BarChart3 className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Benchmark Data</h3>
          </div>
          <p className="text-xs text-t-faint mb-3">
            Import TradingView CSV exports to compare your net worth against benchmarks.
          </p>
          <div className="space-y-3">
            {(Object.keys(BENCHMARK_CONFIG) as BenchmarkId[]).map((key) => {
              const config = BENCHMARK_CONFIG[key];
              const range = getBenchmarkDateRange(key);
              const status = benchmarkStatus[key];
              return (
                <div key={key} className="px-3 py-2.5 bg-surface rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-t-secondary" style={{ color: config.color }}>
                      {config.label}
                    </span>
                  </div>
                  {range ? (
                    <p className="text-xs text-t-muted mb-2">
                      {formatMonthYear(range.from)}
                      {' – '}
                      {formatMonthYear(range.to)}
                      {' · '}
                      {range.count} data points
                    </p>
                  ) : (
                    <p className="text-xs text-t-faint mb-2">No data imported</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleBenchmarkImport(key)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-surface-alt text-t-secondary rounded-md text-xs font-medium hover:bg-surface-active transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      Import CSV
                    </button>
                    {range && (
                      <button
                        onClick={() => handleBenchmarkClear(key)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-loss hover:bg-loss-bg rounded-md text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>
                  {status && (
                    <p className={`text-xs mt-1.5 ${status.startsWith('Error') ? 'text-loss' : 'text-gain'}`}>
                      {status}
                    </p>
                  )}
                  {/* Hidden file input for browser fallback */}
                  {!isElectron && (
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      ref={(el) => { benchmarkFileRefs.current[key] = el; }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Backup Section */}
        <div>
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <HardDrive className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Data Backup</h3>
          </div>
          <p className="text-xs text-t-faint mb-3">
            {holdings.length} holdings, {snapshots.length} snapshots
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Backup
            </button>
            <button
              onClick={handleImport}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import Backup
            </button>
          </div>
          {backupStatus && (
            <p className={`text-xs mt-2 ${backupStatus.includes('failed') || backupStatus.includes('Invalid') || backupStatus.includes('Failed') ? 'text-loss' : 'text-gain'}`}>{backupStatus}</p>
          )}
        </div>

        {/* Auto Backup Section (Electron only) */}
        {isElectron && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
              <HardDrive className="w-4 h-4 text-t-muted" />
              <h3 className="text-sm font-semibold text-t-primary">Auto Backup</h3>
            </div>
            <div className="flex items-center justify-between py-2 px-3 bg-surface rounded-lg mb-3">
              <div>
                <p className="text-sm font-medium text-t-secondary">Enable Auto Backup</p>
                <p className="text-xs text-t-muted">Silently save backups on a schedule</p>
              </div>
              <button
                type="button"
                onClick={() => setAutoEnabled(!autoBackupSettings.enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoBackupSettings.enabled ? 'bg-accent' : 'bg-surface-active'
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-surface-card transition-transform ${
                  autoBackupSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {autoBackupSettings.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-t-muted mb-1">Backup Folder</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={autoBackupSettings.folderPath || 'No folder selected'}
                      readOnly
                      className="flex-1 px-3 py-2 border border-b-default rounded-lg text-sm bg-surface text-t-muted truncate"
                    />
                    <button onClick={chooseAutoFolder} className="px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors">
                      Choose
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-t-muted mb-1">Frequency</label>
                  <div className="flex bg-surface-alt rounded-lg p-0.5 w-fit">
                    {(['daily', 'weekly'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setAutoFrequency(f)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                          autoBackupSettings.frequency === f ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted'
                        }`}
                      >{f}</button>
                    ))}
                  </div>
                </div>
                {autoBackupSettings.lastBackup && (
                  <p className="text-xs text-t-faint">
                    Last backup: {new Date(autoBackupSettings.lastBackup).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transaction ledger source-of-truth (Advanced — Phase 3 ramp) */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <Receipt className="w-4 h-4 text-t-muted" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-t-primary">
              Transaction ledger
              <span className="text-xs font-normal text-t-faint ml-1">Advanced — opt-in</span>
            </h3>
          </div>
          <p className="text-xs text-t-faint mb-3">
            When on, holding shares and weighted-avg cost basis are derived from
            the transaction ledger instead of read from storage. The validator
            below shows whether the two sources currently agree — flip the toggle
            on only when there are <em>no</em> divergences.
          </p>
          <div className="flex items-center justify-between gap-3 mb-3 px-3 py-2 bg-surface-alt rounded-lg">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-t-primary">Use ledger as source of truth</span>
              <span className="text-xs text-t-muted">
                {useTxnSourceOfTruth ? 'On — values come from transactions' : 'Off — values come from holdings storage'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useTxnSourceOfTruth}
              aria-label="Use ledger as source of truth"
              onClick={() => setUseTxnSourceOfTruth(!useTxnSourceOfTruth)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                useTxnSourceOfTruth ? 'bg-accent' : 'bg-surface-active'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                  useTxnSourceOfTruth ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className={`text-xs px-3 py-2 rounded-lg ${ledgerDivergences.length === 0 ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
            <p className="font-semibold mb-1">
              {ledgerDivergences.length === 0
                ? 'Ledger and storage agree.'
                : `${ledgerDivergences.length} holding${ledgerDivergences.length === 1 ? '' : 's'} diverge.`}
            </p>
            {ledgerDivergences.length > 0 && (
              <ul className="space-y-0.5 mt-1">
                {ledgerDivergences.slice(0, 5).map((d) => (
                  <li key={d.holdingId} className="font-mono">
                    {d.ticker}: stored {d.storedShares} sh @ ${d.storedBuyPrice.toFixed(2)} →
                    derived {d.derivedShares} sh @ ${d.derivedBuyPrice.toFixed(2)}
                    {' '}(Δ ${d.costBasisDeltaAmount.toFixed(2)})
                  </li>
                ))}
                {ledgerDivergences.length > 5 && (
                  <li className="italic">… and {ledgerDivergences.length - 5} more.</li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* Storage Backend (Advanced) */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <Database className="w-4 h-4 text-t-muted" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-t-primary">Storage Backend <span className="text-xs font-normal text-t-faint ml-1">Advanced</span></h3>
          </div>
          <p className="text-xs text-t-faint mb-3">
            Currently storing data in <span className="font-semibold text-t-secondary">{currentBackend === 'indexedDB' ? 'IndexedDB' : 'localStorage'}</span>.
            IndexedDB has a larger capacity and doesn't block the main thread on writes.
            Switching saves a backup first and leaves the previous backend untouched so you can roll back.
          </p>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              disabled={switching || currentBackend === 'localStorage'}
              onClick={() => handleSwitchBackend('localStorage')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                currentBackend === 'localStorage'
                  ? 'bg-accent/15 text-accent cursor-default'
                  : 'bg-surface-alt text-t-secondary hover:bg-surface-active disabled:opacity-50'
              }`}
            >
              localStorage{currentBackend === 'localStorage' && ' (current)'}
            </button>
            <button
              type="button"
              disabled={switching || currentBackend === 'indexedDB'}
              onClick={() => handleSwitchBackend('indexedDB')}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                currentBackend === 'indexedDB'
                  ? 'bg-accent/15 text-accent cursor-default'
                  : 'bg-surface-alt text-t-secondary hover:bg-surface-active disabled:opacity-50'
              }`}
            >
              IndexedDB{currentBackend === 'indexedDB' && ' (current)'}
            </button>
            {switching && (
              <span className="text-xs text-t-muted flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-b-input border-t-accent rounded-full animate-spin" aria-hidden="true" />
                Migrating…
              </span>
            )}
          </div>
          {switchStatus && (
            <p
              role="alert"
              className={`text-xs mt-2 ${switchStatus.kind === 'success' ? 'text-gain' : 'text-loss'}`}
            >
              {switchStatus.message}
            </p>
          )}
        </div>

        {/* Portfolios Section */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <FolderOpen className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Portfolios</h3>
          </div>
          <p className="text-xs text-t-faint mb-3">
            Organize holdings into separate portfolios (buckets within net worth).
          </p>
          <button
            onClick={() => setShowManagePortfolios(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
            Manage Portfolios
          </button>
        </div>

        {/* CSV Import Section */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-b-subtle">
            <FileSpreadsheet className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Import from CSV</h3>
          </div>
          <p className="text-xs text-t-faint mb-3">
            Import holdings or transactions from brokerage CSV exports.
          </p>
          <button
            onClick={() => setShowCsvImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Import CSV
          </button>
        </div>
      </Modal>

    {showCsvImport && <CsvImportModal onClose={() => setShowCsvImport(false)} />}
    {showManagePortfolios && <ManagePortfoliosModal onClose={() => setShowManagePortfolios(false)} />}
    </>
  );
}
