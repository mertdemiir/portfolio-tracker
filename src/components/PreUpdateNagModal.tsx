import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, Check } from 'lucide-react';
import { Modal } from './Modal';
import { gatherBackupData, serializeBackup } from '../data/backup';
import { updateAppMeta, type AppMeta } from '../data/schema';

interface Props {
  currentAppVersion: string;
  storedAppVersion: string | null;
  onAcknowledged: () => void;
}

/**
 * Shown exactly once when a user boots a new app version that differs from
 * their stored `lastAppVersion`. Requires the user to export a backup
 * before we proceed — we don't let them dismiss without one.
 *
 * First-run behavior: if `storedAppVersion` is null (brand-new install, no
 * data to protect), the nag is skipped via the mount-time check in App.tsx.
 */
export function PreUpdateNagModal({ currentAppVersion, storedAppVersion, onAcknowledged }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const acknowledgeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus the primary action for screen readers + keyboard users
  useEffect(() => {
    acknowledgeBtnRef.current?.focus();
  }, []);

  async function handleExport() {
    setStatus('saving');
    setErrorMsg(null);
    try {
      const payload = serializeBackup(gatherBackupData('manual'));
      const isElectron = !!window.electronAPI;
      if (isElectron) {
        const result = await window.electronAPI!.exportData(payload);
        if (result.cancelled) {
          setStatus('idle');
          return;
        }
        if (!result.success) {
          setStatus('error');
          setErrorMsg(result.error ?? 'Unknown error');
          return;
        }
      } else {
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-backup-preupdate-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
      const meta: Partial<AppMeta> = { lastBackupAt: new Date().toISOString() };
      updateAppMeta(meta);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function handleAcknowledge() {
    updateAppMeta({
      preUpdateAckVersion: currentAppVersion,
      lastAppVersion: currentAppVersion,
    });
    onAcknowledged();
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" aria-hidden="true" />
          Back up your data first
        </span>
      }
      onClose={handleAcknowledge}
      size="md"
      hideCloseButton
      disableDismiss
    >
      <p className="text-sm text-t-secondary mb-4 leading-relaxed">
        We&apos;re upgrading Portfolio Tracker
        {storedAppVersion ? <> from <span className="font-mono text-xs">{storedAppVersion}</span> to </> : ' to '}
        <span className="font-mono text-xs">{currentAppVersion}</span>. Please export a backup before we continue. Your
        data is never sent anywhere — the file stays on your machine.
      </p>

      <div className="space-y-2 mb-4">
        <button
          onClick={handleExport}
          disabled={status === 'saving'}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover disabled:opacity-60 transition-colors"
        >
          {status === 'saving' ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
              Saving backup…
            </>
          ) : status === 'saved' ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" />
              Backup saved
            </>
          ) : (
            <>
              <Download className="w-4 h-4" aria-hidden="true" />
              Export backup
            </>
          )}
        </button>
        {errorMsg && (
          <p role="alert" className="text-xs text-loss">
            Export failed: {errorMsg}
          </p>
        )}
      </div>

      <button
        ref={acknowledgeBtnRef}
        onClick={handleAcknowledge}
        disabled={status !== 'saved'}
        className="w-full py-2 text-sm font-medium text-t-secondary hover:text-t-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'saved' ? 'Continue' : 'Continue (export a backup first)'}
      </button>
    </Modal>
  );
}
