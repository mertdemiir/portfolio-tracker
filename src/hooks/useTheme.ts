import { useEffect, useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { ThemeId, ThemePreference } from '../types';

/**
 * Mercury themes only: light + dark.
 *
 * Legacy themes ('midnight', 'heritage', 'terminal') were dropped during
 * the Mercury layout migration. The persisted value from the old picker
 * is normalized on read by `normalizeLegacy()` below — anything that was
 * dark-flavored becomes 'dark', anything light-flavored becomes 'light'.
 */

const CHART_COLORS: Record<ThemeId, {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  refLine: string;
  targetBar: string;
}> = {
  light: {
    grid: '#f0f0ef',
    axis: '#a3a3a3',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e8e8e6',
    tooltipText: '#0a0a0a',
    refLine: '#e8e8e6',
    targetBar: '#d4d4d2',
  },
  dark: {
    grid: '#1a1a1d',
    axis: '#5a5a60',
    tooltipBg: '#111113',
    tooltipBorder: '#222226',
    tooltipText: '#fafafa',
    refLine: '#222226',
    targetBar: '#5a5a60',
  },
};

export function getChartColors(theme: ThemeId) {
  return CHART_COLORS[theme];
}

// ─── Theme-aware chart palettes ───
// Same palette across both themes — Mercury's design relies on the
// surface/contrast contrast doing the work, not bespoke palettes.
const SHARED_CHART_PALETTE = [
  '#3b5bdb', '#10b981', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#ef4444', '#f97316',
  '#14b8a6', '#6366f1',
];

const CHART_PALETTES: Record<ThemeId, string[]> = {
  light: SHARED_CHART_PALETTE,
  dark: SHARED_CHART_PALETTE,
};

export function getChartPalette(theme: ThemeId): string[] {
  return CHART_PALETTES[theme];
}

// ─── Auto-theme resolution ───

function resolveAutoTheme(): ThemeId {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * One-time normalization for users upgrading from a build that supported
 * midnight/heritage/terminal themes. Maps each retired theme to its
 * closest Mercury equivalent.
 *
 *   midnight, terminal   → dark   (both are dark-flavored)
 *   heritage             → light  (cream-on-paper aesthetic)
 *   anything unknown     → auto
 */
function normalizeLegacy(value: unknown): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'auto') return value;
  if (value === 'midnight' || value === 'terminal') return 'dark';
  if (value === 'heritage') return 'light';
  return 'auto';
}

function resolveTheme(pref: ThemePreference): ThemeId {
  if (pref === 'auto') return resolveAutoTheme();
  return pref;
}

// ─── Hex ↔ HSL helpers for accent color manipulation ───

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  h /= 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darkenHex(hex: string, percent: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - percent / 100));
}

function lightenHex(hex: string, percent: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(1, l + percent / 100));
}

function accentLightValue(hex: string, isDark: boolean): string {
  if (isDark) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.14)`;
  }
  return lightenHex(hex, 40);
}

export function useTheme() {
  // Read with the legacy normalizer so any saved 'heritage' / 'midnight' /
  // 'terminal' value is rehydrated as a Mercury-supported preference.
  const [rawPref, setRawPref] = useLocalStorage<ThemePreference>('theme', 'auto');
  const themePreference: ThemePreference = normalizeLegacy(rawPref);

  // If we just normalized a legacy value, write it back so subsequent
  // reads don't keep hitting the migration path.
  useEffect(() => {
    if (rawPref !== themePreference) {
      setRawPref(themePreference);
    }
  }, [rawPref, themePreference, setRawPref]);

  const [accentColor, setAccentColor] = useLocalStorage<string>('accent-color', '#3b5bdb');
  const [theme, setResolvedTheme] = useState<ThemeId>(() => resolveTheme(themePreference));

  // Listen for system appearance changes when in auto mode
  useEffect(() => {
    if (themePreference !== 'auto') {
      setResolvedTheme(themePreference);
      return;
    }
    setResolvedTheme(resolveAutoTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themePreference]);

  // Apply resolved theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const styles = getComputedStyle(document.documentElement);
    const surface = styles.getPropertyValue('--surface').trim();
    if (surface) {
      document.body.style.backgroundColor = surface;
    }
  }, [theme]);

  // Apply accent color as CSS custom properties
  useEffect(() => {
    const isDark = theme === 'dark';
    const el = document.documentElement;
    el.style.setProperty('--accent', accentColor);
    el.style.setProperty('--accent-hover', darkenHex(accentColor, 10));
    el.style.setProperty('--accent-light', accentLightValue(accentColor, isDark));
  }, [accentColor, theme]);

  const setTheme = useCallback((pref: ThemePreference) => {
    setRawPref(pref);
  }, [setRawPref]);

  return {
    theme,                // ThemeId — always resolved
    themePreference,      // ThemePreference — what user selected ('auto' | ThemeId)
    setTheme,             // accepts ThemePreference
    accentColor,
    setAccentColor,
  };
}
