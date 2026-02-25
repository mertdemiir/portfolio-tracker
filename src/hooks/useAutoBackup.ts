import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface AutoBackupSettings {
  enabled: boolean;
  folderPath: string | null;
  frequency: 'daily' | 'weekly';
  lastBackup: string | null;
}

const DEFAULT_SETTINGS: AutoBackupSettings = {
  enabled: false,
  folderPath: null,
  frequency: 'daily',
  lastBackup: null,
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

function gatherBackupData(): string {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    holdings: JSON.parse(localStorage.getItem('portfolio-holdings') || '[]'),
    snapshots: JSON.parse(localStorage.getItem('portfolio-snapshots') || '[]'),
    customCategories: JSON.parse(localStorage.getItem('custom-categories') || '[]'),
    apiKey: localStorage.getItem('finnhub-api-key')?.replace(/^"|"$/g, '') || '',
    transactions: JSON.parse(localStorage.getItem('transactions') || '[]'),
    targetAllocations: JSON.parse(localStorage.getItem('target-allocations') || '[]'),
    nwMilestones: JSON.parse(localStorage.getItem('nw-milestones') || '[]'),
  };
  return JSON.stringify(backup, null, 2);
}

function isDue(settings: AutoBackupSettings): boolean {
  if (!settings.enabled || !settings.folderPath) return false;
  if (!settings.lastBackup) return true;

  const last = new Date(settings.lastBackup).getTime();
  const now = Date.now();
  const interval = settings.frequency === 'daily' ? DAY_MS : WEEK_MS;
  return now - last >= interval;
}

export function useAutoBackup() {
  const [settings, setSettings] = useLocalStorage<AutoBackupSettings>('auto-backup-settings', DEFAULT_SETTINGS);
  const [, forceUpdate] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const performBackup = useCallback(async () => {
    const current = settingsRef.current;
    if (!current.enabled || !current.folderPath || !window.electronAPI) return;
    try {
      const data = gatherBackupData();
      const result = await window.electronAPI.autoBackup(data, current.folderPath);
      if (result.success) {
        setSettings((prev) => ({ ...prev, lastBackup: new Date().toISOString() }));
      }
    } catch {
      // Silently fail for auto backup
    }
  }, [setSettings]);

  // Check on mount and every hour
  useEffect(() => {
    if (!window.electronAPI) return;

    function check() {
      if (isDue(settingsRef.current)) {
        performBackup();
      }
    }

    check();
    const interval = setInterval(check, HOUR_MS);
    return () => clearInterval(interval);
  }, [performBackup]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, enabled }));
    forceUpdate((n) => n + 1);
  }, [setSettings]);

  const setFrequency = useCallback((frequency: 'daily' | 'weekly') => {
    setSettings((prev) => ({ ...prev, frequency }));
  }, [setSettings]);

  const chooseFolder = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.chooseBackupFolder();
    if (result.success && result.folderPath) {
      setSettings((prev) => ({ ...prev, folderPath: result.folderPath! }));
    }
  }, [setSettings]);

  return { settings, setEnabled, setFrequency, chooseFolder, performBackup };
}
