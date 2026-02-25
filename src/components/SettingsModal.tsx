import { useState, useEffect, useRef } from 'react';
import { X, Trash2, Plus, Key, Tag, Download, Upload, HardDrive, FileSpreadsheet, Sun, Moon, Stars, BarChart3, FolderOpen } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useAutoBackup } from '../hooks/useAutoBackup';
import { CsvImportModal } from './CsvImportModal';
import { ManagePortfoliosModal } from './ManagePortfoliosModal';
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
  const { holdings, snapshots, theme, setTheme, accentColor, setAccentColor, baseCurrency, setBaseCurrency, importBenchmarkCsv, clearBenchmark, getBenchmarkDateRange } = usePortfolioContext();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showManagePortfolios, setShowManagePortfolios] = useState(false);
  const [benchmarkStatus, setBenchmarkStatus] = useState<Record<string, string>>({});
  const benchmarkFileRefs = useRef<Record<string, HTMLInputElement | null>>({ spx: null, btc: null, gold: null });
  const { settings: autoBackupSettings, setEnabled: setAutoEnabled, setFrequency: setAutoFrequency, chooseFolder: chooseAutoFolder } = useAutoBackup();

  const isElectron = !!window.electronAPI;

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      holdings: JSON.parse(localStorage.getItem('portfolio-holdings') || '[]'),
      snapshots: JSON.parse(localStorage.getItem('portfolio-snapshots') || '[]'),
      customCategories: JSON.parse(localStorage.getItem('custom-categories') || '[]'),
      apiKey: localStorage.getItem('finnhub-api-key')?.replace(/^"|"$/g, '') || '',
      transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
      targetAllocations: JSON.parse(localStorage.getItem('target-allocations') || '[]'),
      nwTarget: JSON.parse(localStorage.getItem('nw-target') || 'null'),
      nwMilestones: JSON.parse(localStorage.getItem('nw-milestones') || '[]'),
      benchmarkDataSpx: JSON.parse(localStorage.getItem('benchmark-data-spx') || '[]'),
      benchmarkDataBtc: JSON.parse(localStorage.getItem('benchmark-data-btc') || '[]'),
      benchmarkDataGold: JSON.parse(localStorage.getItem('benchmark-data-gold') || '[]'),
      accentColor: localStorage.getItem('accent-color')?.replace(/^"|"$/g, '') || '#3b82f6',
      watchlistItems: JSON.parse(localStorage.getItem('watchlist-items') || '[]'),
      holdingOrder: JSON.parse(localStorage.getItem('holding-order') || '[]'),
      baseCurrency: localStorage.getItem('base-currency')?.replace(/^"|"$/g, '') || 'USD',
      portfolios: JSON.parse(localStorage.getItem('portfolios') || '[]'),
      liabilities: JSON.parse(localStorage.getItem('liabilities') || '[]'),
      annotations: JSON.parse(localStorage.getItem('timeline-annotations') || '[]'),
    };

    if (isElectron) {
      const result = await window.electronAPI!.exportData(JSON.stringify(backup, null, 2));
      if (result.success) {
        setBackupStatus('Backup saved!');
      } else if (!result.cancelled) {
        setBackupStatus(`Export failed: ${result.error}`);
      }
    } else {
      // Browser fallback: download as file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
      const backup = JSON.parse(jsonString!);
      if (!backup.holdings || !backup.snapshots) {
        setBackupStatus('Invalid backup file.');
        setTimeout(() => setBackupStatus(null), 3000);
        return;
      }
      if (!confirm('This will replace ALL your current data with the backup. Continue?')) return;

      localStorage.setItem('portfolio-holdings', JSON.stringify(backup.holdings));
      localStorage.setItem('portfolio-snapshots', JSON.stringify(backup.snapshots));
      if (backup.customCategories) localStorage.setItem('custom-categories', JSON.stringify(backup.customCategories));
      if (backup.apiKey) localStorage.setItem('finnhub-api-key', JSON.stringify(backup.apiKey));
      if (backup.transactions) localStorage.setItem('transactions', JSON.stringify(backup.transactions));
      if (backup.targetAllocations) localStorage.setItem('target-allocations', JSON.stringify(backup.targetAllocations));
      if (backup.nwTarget !== undefined) localStorage.setItem('nw-target', JSON.stringify(backup.nwTarget));
      if (backup.nwMilestones) localStorage.setItem('nw-milestones', JSON.stringify(backup.nwMilestones));
      if (backup.benchmarkDataSpx) localStorage.setItem('benchmark-data-spx', JSON.stringify(backup.benchmarkDataSpx));
      if (backup.benchmarkDataBtc) localStorage.setItem('benchmark-data-btc', JSON.stringify(backup.benchmarkDataBtc));
      if (backup.benchmarkDataGold) localStorage.setItem('benchmark-data-gold', JSON.stringify(backup.benchmarkDataGold));
      if (backup.accentColor) localStorage.setItem('accent-color', JSON.stringify(backup.accentColor));
      if (backup.watchlistItems) localStorage.setItem('watchlist-items', JSON.stringify(backup.watchlistItems));
      if (backup.holdingOrder) localStorage.setItem('holding-order', JSON.stringify(backup.holdingOrder));
      if (backup.baseCurrency) localStorage.setItem('base-currency', JSON.stringify(backup.baseCurrency));
      if (backup.portfolios) localStorage.setItem('portfolios', JSON.stringify(backup.portfolios));
      if (backup.liabilities) localStorage.setItem('liabilities', JSON.stringify(backup.liabilities));
      if (backup.annotations) localStorage.setItem('timeline-annotations', JSON.stringify(backup.annotations));

      window.location.reload();
    } catch {
      setBackupStatus('Failed to parse backup file.');
      setTimeout(() => setBackupStatus(null), 3000);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface-card rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-t-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-alt rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-t-muted" />
          </button>
        </div>

        {/* Appearance Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Appearance</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'light' as ThemeId, label: 'Light', icon: Sun, bg: '#f8fafc', card: '#ffffff', text: '#0f172a' },
              { id: 'dark' as ThemeId, label: 'Dark', icon: Moon, bg: '#1e293b', card: '#334155', text: '#f1f5f9' },
              { id: 'midnight' as ThemeId, label: 'Midnight', icon: Stars, bg: '#020617', card: '#0f172a', text: '#f8fafc' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                  theme === t.id
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
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    accentColor === p.color ? 'border-t-primary scale-110' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: p.color }}
                  title={p.name}
                />
              ))}
              <label className="relative w-7 h-7 rounded-full border-2 border-dashed border-b-input cursor-pointer hover:border-b-default transition-colors overflow-hidden" title="Custom color">
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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-t-muted" />
            <h3 className="text-sm font-semibold text-t-primary">Finnhub API Key</h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Enter your Finnhub API key"
              className="flex-1 px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleSaveKey}
              disabled={!keyInput.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {keySaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-t-faint mt-1.5">
            Required for live stock & ETF prices.
          </p>
        </div>

        {/* Custom Categories Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
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
                    className="p-1 hover:bg-red-50 rounded transition-colors"
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
              className="flex-1 px-3 py-2 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
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
                      {new Date(range.from).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(range.to).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-red-500 hover:bg-red-50 rounded-md text-xs font-medium transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                  </div>
                  {status && (
                    <p className={`text-xs mt-1.5 ${status.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
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
          <div className="flex items-center gap-2 mb-3">
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
            <p className="text-xs text-emerald-600 mt-2">{backupStatus}</p>
          )}
        </div>

        {/* Auto Backup Section (Electron only) */}
        {isElectron && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
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
                  autoBackupSettings.enabled ? 'bg-blue-600' : 'bg-surface-active'
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

        {/* Portfolios Section */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
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
          <div className="flex items-center gap-2 mb-3">
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
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>
      </div>
    </div>

    {showCsvImport && <CsvImportModal onClose={() => setShowCsvImport(false)} />}
    {showManagePortfolios && <ManagePortfoliosModal onClose={() => setShowManagePortfolios(false)} />}
    </>
  );
}
