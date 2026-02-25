import { useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { ThemeId } from '../types';

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
    grid: '#f1f5f9',
    axis: '#94a3b8',
    tooltipBg: '#ffffff',
    tooltipBorder: '#e2e8f0',
    tooltipText: '#0f172a',
    refLine: '#e2e8f0',
    targetBar: '#cbd5e1',
  },
  dark: {
    grid: '#3f4f63',
    axis: '#64748b',
    tooltipBg: '#334155',
    tooltipBorder: '#475569',
    tooltipText: '#f1f5f9',
    refLine: '#475569',
    targetBar: '#64748b',
  },
  midnight: {
    grid: '#1e293b',
    axis: '#475569',
    tooltipBg: '#0f172a',
    tooltipBorder: '#1e293b',
    tooltipText: '#f8fafc',
    refLine: '#1e293b',
    targetBar: '#334155',
  },
};

export function getChartColors(theme: ThemeId) {
  return CHART_COLORS[theme];
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
  const [theme, setTheme] = useLocalStorage<ThemeId>('theme', 'light');
  const [accentColor, setAccentColor] = useLocalStorage<string>('accent-color', '#3b82f6');

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
    const isDark = theme === 'dark' || theme === 'midnight';
    const el = document.documentElement;
    el.style.setProperty('--accent', accentColor);
    el.style.setProperty('--accent-hover', darkenHex(accentColor, 10));
    el.style.setProperty('--accent-light', accentLightValue(accentColor, isDark));
  }, [accentColor, theme]);

  return { theme, setTheme, accentColor, setAccentColor };
}
