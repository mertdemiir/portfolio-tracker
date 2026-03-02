import { forwardRef } from 'react';
import { formatCurrency, formatPercent, formatSignedCurrency } from '../utils/formatters';
import type { EnrichedHolding, NetWorthSummary, PortfolioSummary, ThemeId } from '../types';

interface ShareCardProps {
  netWorthSummary: NetWorthSummary;
  portfolioSummary: PortfolioSummary;
  topHoldings: EnrichedHolding[];
  anonymize: boolean;
  theme?: ThemeId;
}

const THEME_STYLES: Record<ThemeId, {
  bg: string; text: string; muted: string; faint: string;
  subtle: string; accent1: string; accent2: string;
}> = {
  light: {
    bg: 'linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)',
    text: '#111827',
    muted: '#6b7280',
    faint: '#9ca3af',
    subtle: 'rgba(0,0,0,0.04)',
    accent1: 'rgba(99,102,241,0.08)',
    accent2: 'rgba(16,185,129,0.06)',
  },
  dark: {
    bg: 'linear-gradient(135deg, #0c0f1a 0%, #151926 100%)',
    text: '#f0f2f5',
    muted: '#6b7a90',
    faint: '#4a5568',
    subtle: 'rgba(255,255,255,0.06)',
    accent1: 'rgba(99,102,241,0.1)',
    accent2: 'rgba(16,185,129,0.08)',
  },
  midnight: {
    bg: 'linear-gradient(135deg, #050509 0%, #0d0d14 100%)',
    text: '#f0f2f5',
    muted: '#5a6478',
    faint: '#3d4555',
    subtle: 'rgba(255,255,255,0.05)',
    accent1: 'rgba(99,102,241,0.12)',
    accent2: 'rgba(16,185,129,0.08)',
  },
  heritage: {
    bg: 'linear-gradient(135deg, #f4f1ec 0%, #eceae5 100%)',
    text: '#1a1612',
    muted: '#6b6358',
    faint: '#928a7e',
    subtle: 'rgba(26, 22, 18, 0.04)',
    accent1: 'rgba(184, 134, 11, 0.08)',
    accent2: 'rgba(37, 107, 71, 0.06)',
  },
  terminal: {
    bg: 'linear-gradient(135deg, #0a0a0a 0%, #111111 100%)',
    text: '#00ff88',
    muted: '#5a7a6a',
    faint: '#334a3f',
    subtle: 'rgba(0, 255, 136, 0.04)',
    accent1: 'rgba(0, 212, 255, 0.1)',
    accent2: 'rgba(0, 255, 136, 0.06)',
  },
};

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ netWorthSummary, portfolioSummary, topHoldings, anonymize, theme = 'dark' }, ref) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const gained = portfolioSummary.totalDailyChange >= 0;
    const s = THEME_STYLES[theme];

    return (
      <div
        ref={ref}
        style={{
          width: 600,
          height: 400,
          background: s.bg,
          color: s.text,
          fontFamily: theme === 'heritage'
            ? '"Source Serif 4", Georgia, serif'
            : theme === 'terminal'
            ? '"JetBrains Mono", monospace'
            : '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: 16,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: s.accent1 }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: s.accent2 }} />

        {/* Header */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 14, color: s.muted, marginBottom: 4 }}>Net Worth</div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>
            {anonymize ? '***' : formatCurrency(netWorthSummary.totalNetWorth)}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: s.faint, textTransform: 'uppercase', letterSpacing: 1 }}>Daily Change</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: gained ? '#34d399' : '#f87171', marginTop: 2 }}>
                {anonymize ? formatPercent(portfolioSummary.totalDailyChangePercent) : `${formatSignedCurrency(portfolioSummary.totalDailyChange)} (${formatPercent(portfolioSummary.totalDailyChangePercent)})`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: s.faint, textTransform: 'uppercase', letterSpacing: 1 }}>Unrealized Return</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: portfolioSummary.totalGainLoss >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>
                {anonymize ? formatPercent(portfolioSummary.totalGainLossPercent) : `${formatSignedCurrency(portfolioSummary.totalGainLoss)} (${formatPercent(portfolioSummary.totalGainLossPercent)})`}
              </div>
            </div>
          </div>
        </div>

        {/* Top Holdings */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 11, color: s.faint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Top Holdings
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {topHoldings.slice(0, 5).map((h) => (
              <div
                key={h.id}
                style={{
                  flex: 1,
                  background: s.subtle,
                  borderRadius: 8,
                  padding: '8px 10px',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{h.ticker}</div>
                <div style={{ fontSize: 11, color: s.muted }}>{h.allocation.toFixed(1)}%</div>
                <div style={{ fontSize: 11, color: h.gainLossPercent >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>
                  {formatPercent(h.gainLossPercent)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <span style={{ fontSize: 11, color: s.faint }}>{today}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: s.faint }}>Wealth Tracker</span>
        </div>
      </div>
    );
  }
);

ShareCard.displayName = 'ShareCard';
