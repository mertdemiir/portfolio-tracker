import { useEffect, useState, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { ThemeId, ThemePreference } from '../types';

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
    grid: '#f3f4f6',
    axis: '#9ca3af',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e5e7eb',
    tooltipText: '#111827',
    refLine: '#e5e7eb',
    targetBar: '#d1d5db',
  },
  dark: {
    grid: '#1a2030',
    axis: '#4a5568',
    tooltipBg: '#151926',
    tooltipBorder: '#1f2937',
    tooltipText: '#f0f2f5',
    refLine: '#1f2937',
    targetBar: '#4a5568',
  },
  midnight: {
    grid: '#141420',
    axis: '#3d4555',
    tooltipBg: '#0d0d14',
    tooltipBorder: '#1a1a28',
    tooltipText: '#f0f2f5',
    refLine: '#1a1a28',
    targetBar: '#3d4555',
  },
  heritage: {
    grid: '#e8e1d5',
    axis: '#a09580',
    tooltipBg: '#faf7f2',
    tooltipBorder: '#d9d0c1',
    tooltipText: '#2c2418',
    refLine: '#d9d0c1',
    targetBar: '#c4b9a8',
  },
  terminal: {
    grid: '#122218',
    axis: '#334a3f',
    tooltipBg: '#111111',
    tooltipBorder: '#1a3a2a',
    tooltipText: '#00ff88',
    refLine: '#1a3a2a',
    targetBar: '#2a5a3a',
  },
};

export function getChartColors(theme: ThemeId) {
  return CHART_COLORS[theme];
}

// ─── Theme-aware chart palettes ───

const CHART_PALETTES: Record<ThemeId, string[]> = {
  light: [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  ],
  dark: [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  ],
  midnight: [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#f97316', '#14b8a6', '#3b82f6',
  ],
  heritage: [
    '#b8860b', '#2d6a4f', '#7a6e5d', '#9b2226', '#6b5b3e',
    '#4a6741', '#8b6914', '#5c4033', '#7b8b6f', '#a67c52',
  ],
  terminal: [
    '#00ff88', '#00d4ff', '#ffaa00', '#ff3366', '#aa55ff',
    '#00ffcc', '#ff6600', '#66ff33', '#ff00aa', '#33aaff',
  ],
};

export function getChartPalette(theme: ThemeId): string[] {
  return CHART_PALETTES[theme];
}

// ─── Auto-theme resolution ───

function resolveAutoTheme(): ThemeId {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'terminal' : 'heritage';
  }
  return 'heritage';
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
    // For dark themes, use rgba with low opacity
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.15)`;
  }
  return lightenHex(hex, 40);
}

export function useTheme() {
  const [themePreference, setThemePreference] = useLocalStorage<ThemePreference>('theme', 'auto');
  const [accentColor, setAccentColor] = useLocalStorage<string>('accent-color', '#3b82f6');
  const [theme, setResolvedTheme] = useState<ThemeId>(() => resolveTheme(themePreference));

  // Listen for system appearance changes when in auto mode
  useEffect(() => {
    if (themePreference !== 'auto') {
      setResolvedTheme(themePreference);
      return;
    }

    // Initial resolve
    setResolvedTheme(resolveAutoTheme());

    // Listen for changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'terminal' : 'heritage');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themePreference]);

  // Apply resolved theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    // Update body background to match theme
    const styles = getComputedStyle(document.documentElement);
    const surface = styles.getPropertyValue('--surface').trim();
    if (surface) {
      document.body.style.backgroundColor = surface;
    }
  }, [theme]);

  // Apply accent color as CSS custom properties
  useEffect(() => {
    const isDark = theme !== 'light' && theme !== 'heritage';
    const el = document.documentElement;
    el.style.setProperty('--accent', accentColor);
    el.style.setProperty('--accent-hover', darkenHex(accentColor, 10));
    el.style.setProperty('--accent-light', accentLightValue(accentColor, isDark));
  }, [accentColor, theme]);

  const setTheme = useCallback((pref: ThemePreference) => {
    setThemePreference(pref);
  }, [setThemePreference]);

  return {
    theme,                // ThemeId — always resolved, use for rendering
    themePreference,      // ThemePreference — what user selected ('auto' | ThemeId)
    setTheme,             // accepts ThemePreference
    accentColor,
    setAccentColor,
  };
}
