import { DollarSign, TrendingUp, TrendingDown, BarChart3, Clock, Wallet } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { formatCurrency, formatSignedCurrency, formatPercent } from '../utils/formatters';
import { EmptyState } from './EmptyState';

const CATEGORY_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-red-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500',
];

export function Dashboard() {
  const {
    portfolioSummary,
    portfolioEnrichedHoldings,
    netWorthSummary,
    allEnrichedHoldings,
    pricesLoading,
  } = usePortfolioContext();

  if (allEnrichedHoldings.length === 0) {
    return <EmptyState onAdd={() => {}} />;
  }

  const portfolioCards = [
    {
      title: 'Portfolio Value',
      value: formatCurrency(portfolioSummary.totalValue),
      icon: DollarSign,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Total P&L',
      value: formatSignedCurrency(portfolioSummary.totalGainLoss),
      subtitle: formatPercent(portfolioSummary.totalGainLossPercent),
      icon: portfolioSummary.totalGainLoss >= 0 ? TrendingUp : TrendingDown,
      color: portfolioSummary.totalGainLoss >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
      valueColor: portfolioSummary.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: "Today's Change",
      value: formatSignedCurrency(portfolioSummary.totalDailyChange),
      subtitle: formatPercent(portfolioSummary.totalDailyChangePercent),
      icon: Clock,
      color: portfolioSummary.totalDailyChange >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
      valueColor: portfolioSummary.totalDailyChange >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Holdings',
      value: portfolioSummary.holdingCount.toString(),
      subtitle: `Cost basis: ${formatCurrency(portfolioSummary.totalCostBasis)}`,
      icon: BarChart3,
      color: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
        {pricesLoading && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            Updating prices...
          </span>
        )}
      </div>

      {/* Section A: Net Worth Hero */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Total Net Worth</p>
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(netWorthSummary.totalNetWorth)}
            </p>
          </div>
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-slate-500">Portfolio</span>
            <p className="font-semibold text-slate-800">{formatCurrency(netWorthSummary.totalPortfolioValue)}</p>
          </div>
          <div>
            <span className="text-slate-500">Other Assets</span>
            <p className="font-semibold text-slate-800">{formatCurrency(netWorthSummary.totalNonPortfolioValue)}</p>
          </div>
          <div>
            <span className="text-slate-500">Total Holdings</span>
            <p className="font-semibold text-slate-800">{netWorthSummary.holdingCount}</p>
          </div>
        </div>
      </div>

      {/* Section B: Portfolio Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {portfolioCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl border border-slate-200 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-slate-500">{card.title}</span>
            </div>
            <p className={`text-2xl font-bold ${card.valueColor || 'text-slate-900'}`}>
              {card.value}
            </p>
            {card.subtitle && (
              <p className={`text-sm mt-0.5 ${card.valueColor || 'text-slate-500'}`}>
                {card.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Section C: Net Worth by Category */}
      {netWorthSummary.categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Net Worth by Category</h3>
          <div className="space-y-3">
            {netWorthSummary.categoryBreakdown.map((cat, i) => (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-700">{cat.label}</span>
                  <div className="text-sm text-right">
                    <span className="font-medium text-slate-900">{formatCurrency(cat.value)}</span>
                    <span className="text-slate-400 ml-2">{cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                    style={{ width: `${Math.max(cat.percentage, 0.5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section D: Top Movers (portfolio only) */}
      {portfolioEnrichedHoldings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Top Movers Today</h3>
          <div className="space-y-2">
            {[...portfolioEnrichedHoldings]
              .sort((a, b) => Math.abs(b.dailyChangePercent) - Math.abs(a.dailyChangePercent))
              .slice(0, 5)
              .map((h) => (
                <div key={h.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-900 text-sm w-16">{h.ticker}</span>
                    <span className="text-xs text-slate-500 truncate max-w-[150px]">{h.name}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-medium ${
                        h.dailyChangePercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(h.dailyChangePercent)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
