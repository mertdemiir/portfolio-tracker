import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Download, RotateCcw, HardDrive } from 'lucide-react';
import { gatherBackupData, serializeBackup } from '../data/backup';
import { listPreMigrationBackups } from '../data/migrations';
import { readAppMeta } from '../data/schema';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Top-level error boundary. When anything below throws during render, we
 * catch it and show a recovery screen with:
 *   - The error message + stack (copyable)
 *   - An "Export all my data" button (so the user never loses data)
 *   - A list of pre-migration backups stored in localStorage
 *   - A "Reload" button (re-mounts the app)
 *   - A "Reset app" button (clears localStorage — ONLY after explicit
 *     confirmation and only if the user has exported first)
 *
 * This is intentionally not a hook — React 19's `use()` and related APIs
 * don't expose a hook-based error boundary primitive yet. Class component
 * is still the canonical approach.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log to console so devs can find it in Electron/browser consoles
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleExport = async () => {
    try {
      const payload = serializeBackup(gatherBackupData('manual'));
      const isElectron = !!window.electronAPI;
      if (isElectron) {
        await window.electronAPI!.exportData(payload);
      } else {
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-backup-recovery-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Recovery export failed:', err);
      alert(
        'Recovery export failed. Please copy the app data manually from localStorage before resetting.'
      );
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    const confirmed = window.confirm(
      'This will clear all app data (holdings, transactions, snapshots, settings).\n\n' +
        'Pre-migration backups in localStorage will be preserved.\n\n' +
        'Have you exported a backup? Type OK to confirm.'
    );
    if (!confirmed) return;
    try {
      // Preserve pre-migration backups; clear everything else
      const keysToPreserve: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('__pre_migration_')) keysToPreserve.push(k);
      }
      const preserved: Record<string, string> = {};
      for (const k of keysToPreserve) {
        const v = localStorage.getItem(k);
        if (v !== null) preserved[k] = v;
      }
      localStorage.clear();
      for (const [k, v] of Object.entries(preserved)) {
        localStorage.setItem(k, v);
      }
      window.location.reload();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Reset failed:', err);
      alert('Reset failed. See console for details.');
    }
  };

  copyErrorDetails = () => {
    const { error, errorInfo } = this.state;
    const meta = readAppMeta();
    const details = [
      `Error: ${error?.message}`,
      `Stack:\n${error?.stack ?? '(none)'}`,
      `Component stack:\n${errorInfo?.componentStack ?? '(none)'}`,
      `Schema version: ${meta.schemaVersion}`,
      `App version: ${meta.lastAppVersion ?? 'unknown'}`,
      `Migration history: ${JSON.stringify(meta.history, null, 2)}`,
    ].join('\n\n');
    try {
      navigator.clipboard.writeText(details);
    } catch {
      // fallback
      alert(details);
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const backups = listPreMigrationBackups();
    const meta = readAppMeta();

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen bg-surface flex items-start justify-center p-6 overflow-y-auto"
      >
        <div className="max-w-2xl w-full bg-surface-card rounded-2xl border border-b-default shadow-lg p-6 my-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" aria-hidden="true" />
            <h1 className="text-xl font-bold text-t-primary">Something went wrong</h1>
          </div>

          <p className="text-sm text-t-secondary mb-4">
            The app hit an unexpected error and can&apos;t continue. Your data is safe and has
            not been modified. You can export a full backup below before trying anything else.
          </p>

          {/* Error details */}
          <div className="bg-surface rounded-lg p-3 mb-4 border border-b-subtle">
            <p className="text-xs font-semibold text-t-muted uppercase tracking-wider mb-1">
              Error
            </p>
            <p className="text-sm font-mono text-loss break-words">
              {this.state.error.message || '(no message)'}
            </p>
            <button
              onClick={this.copyErrorDetails}
              className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors underline"
            >
              Copy full error details
            </button>
          </div>

          {/* Primary action: export */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-t-primary font-medium mb-2">
              Step 1 — export your data before doing anything else
            </p>
            <button
              onClick={this.handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Export all my data
            </button>
          </div>

          {/* Pre-migration backups */}
          {backups.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-t-primary font-medium mb-2 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-t-muted" aria-hidden="true" />
                Pre-migration backups available ({backups.length})
              </p>
              <ul className="text-xs text-t-muted space-y-1 font-mono bg-surface rounded-lg p-3">
                {backups.slice(0, 5).map((b) => (
                  <li key={b.key} className="truncate">
                    {b.key} · {(b.sizeBytes / 1024).toFixed(1)} KB
                  </li>
                ))}
              </ul>
              <p className="text-xs text-t-faint mt-1">
                These are stored in localStorage under the {'"__pre_migration_*"'} keys and can be
                restored manually if needed.
              </p>
            </div>
          )}

          {/* Schema info */}
          <p className="text-xs text-t-faint mb-4">
            Schema version: {meta.schemaVersion} · App version: {meta.lastAppVersion ?? 'unknown'}
          </p>

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-alt text-t-secondary rounded-lg text-sm font-medium hover:bg-surface-active transition-colors"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Reload
            </button>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-loss hover:bg-loss-bg rounded-lg text-sm font-medium transition-colors"
            >
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              Reset app data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
