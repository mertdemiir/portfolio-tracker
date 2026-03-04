import { Sparkles, TrendingUp, TrendingDown, Target, X } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatSignedCurrency, formatPercent, formatCurrency, todayDateString } from '../utils/formatters';
import type { NWMilestone } from '../types';

export function DailyDigest() {
  const {
    portfolioSummary,
    portfolioEnrichedHoldings,
    netWorthSummary,
    snapshots,
  } = usePortfolioContext();

  const [dismissedDate, setDismissedDate] = useLocalStorage('digest-dismissed-date', '');
  const [milestones] = useLocalStorage<NWMilestone[]>('nw-milestones', []);

  const today = todayDateString();
  if (dismissedDate === today) return null;
  if (portfolioEnrichedHoldings.length === 0) return null;

  // Daily change
  const dailyChange = portfolioSummary.totalDailyChange;
  const dailyPct = portfolioSummary.totalDailyChangePercent;
  const gained = dailyChange >= 0;

  // Top mover
  const topMover = [...portfolioEnrichedHoldings]
    .sort((a, b) => Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))[0];

  // Yesterday comparison (use local date to match snapshot keys)
  const todayParts = today.split('-').map(Number);
  const yesterdayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
  const yesterdaySnap = snapshots.find((s) => s.date === yesterdayStr);
  const nwDelta = yesterdaySnap ? netWorthSummary.totalNetWorth - yesterdaySnap.netWorthValue : null;

  // Next milestone
  const nextMilestone = milestones.find((m) => netWorthSummary.totalNetWorth < m.value);
  const milestoneDistance = nextMilestone ? nextMilestone.value - netWorthSummary.totalNetWorth : null;

  const lines: { icon: typeof Sparkles; text: string; color: string }[] = [];

  // Line 1: Daily portfolio change
  lines.push({
    icon: gained ? TrendingUp : TrendingDown,
    text: `Your portfolio ${gained ? 'gained' : 'lost'} ${formatSignedCurrency(dailyChange)} today (${formatPercent(dailyPct)})`,
    color: gained ? 'text-gain' : 'text-loss',
  });

  // Line 2: Top mover
  if (topMover && topMover.dailyChangePercent !== 0) {
    lines.push({
      icon: Sparkles,
      text: `Top mover: ${topMover.ticker} ${formatPercent(topMover.dailyChangePercent)}`,
      color: topMover.dailyChangePercent >= 0 ? 'text-gain' : 'text-loss',
    });
  }

  // Line 3: NW vs yesterday
  if (nwDelta !== null && nwDelta !== 0) {
    lines.push({
      icon: nwDelta >= 0 ? TrendingUp : TrendingDown,
      text: `Net worth is ${nwDelta >= 0 ? 'up' : 'down'} ${formatSignedCurrency(nwDelta)} from yesterday`,
      color: nwDelta >= 0 ? 'text-gain' : 'text-loss',
    });
  }

  // Line 4: Milestone proximity
  if (nextMilestone && milestoneDistance !== null) {
    lines.push({
      icon: Target,
      text: `${formatCurrency(milestoneDistance)} to go until "${nextMilestone.name}"`,
      color: 'text-accent',
    });
  }

  if (lines.length === 0) return null;

  const borderColor = gained ? 'border-l-gain' : 'border-l-loss';

  return (
    <div className={`bg-surface-card card-radius border border-b-default border-l-4 ${borderColor} p-4 mb-6 relative`}>
      <button
        onClick={() => setDismissedDate(today)}
        className="absolute top-2.5 right-2.5 p-1 text-t-faint hover:text-t-muted transition-colors rounded-md hover:bg-surface-alt"
        title="Dismiss for today"
      >
        <X size={14} />
      </button>
      <div className="space-y-2 pr-6">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <line.icon className={`w-3.5 h-3.5 flex-shrink-0 ${line.color}`} />
            <span className="text-sm text-t-secondary">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
