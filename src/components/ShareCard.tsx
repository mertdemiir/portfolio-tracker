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
    bg: 'linear-gradient(135deg, #fafaf9 0%, #e8e8e6 100%)',
    text: '#0a0a0a',
    muted: '#6b6b6b',
    faint: '#a3a3a3',
    subtle: 'rgba(0,0,0,0.04)',
    accent1: 'rgba(59, 91, 219, 0.08)',
    accent2: 'rgba(15, 122, 63, 0.06)',
  },
  dark: {
    bg: 'linear-gradient(135deg, #0a0a0b 0%, #18181b 100%)',
    text: '#fafafa',
    muted: '#8d8d94',
    faint: '#5a5a60',
    subtle: 'rgba(255,255,255,0.06)',
    accent1: 'rgba(109, 135, 255, 0.10)',
    accent2: 'rgba(61, 216, 139, 0.08)',
  },
};

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ netWorthSummary, portfolioSummary, topHoldings, anonymize, theme = 'dark' }, ref) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const gained = portfolioSummary.totalDailyChange.amount >= 0;
    const s = THEME_STYLES[theme];

    return (
      <div
        ref={ref}
        style={{
          width: 600,
          height: 400,
          background: s.bg,
          color: s.text,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
              <div style={{ fontSize: 16, fontWeight: 600, color: portfolioSummary.totalGainLoss.amount >= 0 ? '#34d399' : '#f87171', marginTop: 2 }}>
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
