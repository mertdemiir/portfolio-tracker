import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, FileText, Bookmark, Plus } from 'lucide-react';
import { usePortfolioContext } from '../context/PortfolioContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAnnotations } from '../hooks/useAnnotations';
import { PdfReportModal } from './PdfReportModal';
import { AllocationPieChart } from './AllocationPieChart';
import { GainLossBarChart } from './GainLossBarChart';
import { PortfolioLineChart } from './PortfolioLineChart';
import { NetWorthLineChart } from './NetWorthLineChart';
import { CategoryPieChart } from './CategoryPieChart';
import { SnapshotManager } from './SnapshotManager';
import { MonthlySummary } from './MonthlySummary';
import { AllocationTargetChart } from './AllocationTargetChart';
import { TreemapChart } from './TreemapChart';
import { DrawdownChart } from './DrawdownChart';
import { RollingReturnsChart } from './RollingReturnsChart';
import { CurrencyExposureChart } from './CurrencyExposureChart';
import { AddAnnotationModal } from './AddAnnotationModal';
import { AnnotationsList } from './AnnotationsList';
import type { NWMilestone, BenchmarkId, TimeRange } from '../types';
import { BENCHMARK_CONFIG } from '../types';
import { formatCurrency } from '../utils/formatters';
import { filterByTimeRange } from './NetWorthLineChart';

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

export function Charts() {
  const {
    allEnrichedHoldings,
    filteredEnrichedHoldings,
    netWorthSummary,
    snapshots,
    benchmarkData,
    benchmarkEnabled,
    toggleBenchmark,
  } = usePortfolioContext();

  const [showHistory, setShowHistory] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showAddAnnotation, setShowAddAnnotation] = useState(false);
  const [milestones] = useLocalStorage<NWMilestone[]>('nw-milestones', []);
  const [timeRange, setTimeRange] = useLocalStorage<TimeRange>('chart-time-range', 'ALL');
  const [showAnnotations, setShowAnnotations] = useLocalStorage<boolean>('show-annotations', true);
  const { annotations, addAnnotation, deleteAnnotation } = useAnnotations();
  const hasHoldings = allEnrichedHoldings.length > 0;

  const anyBenchmarkHasData = benchmarkData.spx.length > 0 || benchmarkData.btc.length > 0 || benchmarkData.gold.length > 0;

  const summaryStats = useMemo(() => {
    if (snapshots.length === 0) return null;
    const currentNW = netWorthSummary.totalNetWorth;
    const ath = Math.max(...snapshots.map(s => s.netWorthValue ?? s.totalValue));
    const drawdownPct = ath > 0 ? ((currentNW - ath) / ath) * 100 : 0;
    const filtered = filterByTimeRange(snapshots, timeRange);
    if (filtered.length < 2) return { currentNW, ath, drawdownPct, periodReturn: null };
    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    const firstVal = sorted[0].netWorthValue ?? sorted[0].totalValue;
    const lastVal = sorted[sorted.length - 1].netWorthValue ?? sorted[sorted.length - 1].totalValue;
    const periodReturn = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0;
    return { currentNW, ath, drawdownPct, periodReturn };
  }, [snapshots, netWorthSummary.totalNetWorth, timeRange]);

  return (
    <div>
      {hasHoldings ? (
        <>
          {/* Net Worth Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-t-primary">Net Worth</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowAnnotations(!showAnnotations)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showAnnotations
                      ? 'bg-accent/15 text-accent'
                      : 'text-t-faint hover:text-t-muted hover:bg-surface-alt'
                  }`}
                  title={showAnnotations ? 'Hide annotations' : 'Show annotations'}
                >
                  <Bookmark size={15} />
                </button>
                <button
                  onClick={() => setShowAddAnnotation(true)}
                  className="p-1.5 text-t-faint hover:text-t-muted hover:bg-surface-alt rounded-lg transition-colors"
                  title="Add annotation"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
            {anyBenchmarkHasData && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-t-muted mr-1">Compare:</span>
                {(Object.keys(BENCHMARK_CONFIG) as BenchmarkId[]).map((key) => {
                  const config = BENCHMARK_CONFIG[key];
                  const hasData = benchmarkData[key].length > 0;
                  if (!hasData) return null;
                  const active = benchmarkEnabled[key];
                  return (
                    <button
                      key={key}
                      onClick={() => toggleBenchmark(key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                        active
                          ? 'bg-surface-alt text-t-primary'
                          : 'text-t-muted hover:text-t-secondary'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: config.color, opacity: active ? 1 : 0.4 }}
                      />
                      {config.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary data ribbon */}
          {summaryStats && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 mb-4 text-xs tabular-nums">
              <div>
                <span className="text-t-faint">Net Worth</span>
                <span className="ml-1.5 font-semibold text-t-primary">{formatCurrency(summaryStats.currentNW)}</span>
              </div>
              <span className="text-t-faint">·</span>
              <div>
                <span className="text-t-faint">ATH</span>
                <span className="ml-1.5 font-semibold text-t-primary">{formatCurrency(summaryStats.ath)}</span>
              </div>
              <span className="text-t-faint">·</span>
              <div>
                <span className="text-t-faint">From ATH</span>
                <span className={`ml-1.5 font-semibold ${summaryStats.drawdownPct >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {summaryStats.drawdownPct >= 0 ? '+' : ''}{summaryStats.drawdownPct.toFixed(2)}%
                </span>
              </div>
              {summaryStats.periodReturn !== null && (
                <>
                  <span className="text-t-faint">·</span>
                  <div>
                    <span className="text-t-faint">{timeRange} Return</span>
                    <span className={`ml-1.5 font-semibold ${summaryStats.periodReturn >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {summaryStats.periodReturn >= 0 ? '+' : ''}{summaryStats.periodReturn.toFixed(2)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 mb-6">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === r
                    ? 'bg-accent text-white rounded-lg'
                    : 'text-t-muted hover:text-t-secondary'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Hero: Net Worth Line Chart — full width */}
          <div className="mb-6">
            <NetWorthLineChart
              snapshots={snapshots}
              milestones={milestones}
              benchmarkData={benchmarkData}
              benchmarkEnabled={benchmarkEnabled}
              timeRange={timeRange}
              annotations={annotations}
              showAnnotations={showAnnotations}
            />
          </div>

          {/* Annotations List */}
          {showAnnotations && annotations.length > 0 && (
            <div className="mb-6">
              <AnnotationsList annotations={annotations} onDelete={deleteAnnotation} />
            </div>
          )}

          {/* Category Breakdown */}
          <div className="mb-6">
            <CategoryPieChart categoryBreakdown={netWorthSummary.categoryBreakdown} />
          </div>

          {/* Secondary Charts — 2×2 grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-[11px] text-t-faint mb-1.5">Peak-to-trough decline from all-time highs</p>
              <DrawdownChart snapshots={snapshots} timeRange={timeRange} />
            </div>
            <div>
              <p className="text-[11px] text-t-faint mb-1.5">Annualized trailing 12-month performance</p>
              <RollingReturnsChart snapshots={snapshots} timeRange={timeRange} />
            </div>
            <div>
              <p className="text-[11px] text-t-faint mb-1.5">Portfolio distribution across currencies</p>
              <CurrencyExposureChart holdings={filteredEnrichedHoldings} />
            </div>
            <div>
              <p className="text-[11px] text-t-faint mb-1.5">Current vs target allocation by category</p>
              <AllocationTargetChart />
            </div>
          </div>

          {/* Portfolio Section */}
          {filteredEnrichedHoldings.length > 0 && (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-t-primary mb-6">Portfolio</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <AllocationPieChart holdings={filteredEnrichedHoldings} />
                <GainLossBarChart holdings={filteredEnrichedHoldings} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <PortfolioLineChart snapshots={snapshots} />
                <TreemapChart holdings={filteredEnrichedHoldings} />
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center text-t-muted">
          <p>Add holdings to see charts.</p>
        </div>
      )}

      {/* Generate Report Button */}
      {hasHoldings && (
        <div className="flex justify-end mb-6 mt-6">
          <button
            onClick={() => setShowPdfModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors focus:ring-2 focus:ring-accent/40"
          >
            <FileText className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      )}

      {/* Monthly/Yearly Summary */}
      {hasHoldings && (
        <>
          <h2 className="text-lg font-semibold tracking-tight text-t-primary mb-6">Summary</h2>
          <MonthlySummary />
        </>
      )}

      {/* Snapshot History - collapsible */}
      {hasHoldings && (
        <>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-1.5 text-lg font-semibold tracking-tight text-t-primary mt-6 mb-6 hover:text-t-secondary transition-colors"
          >
            {showHistory ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            History
          </button>
          {showHistory && <SnapshotManager />}
        </>
      )}

      {showPdfModal && <PdfReportModal onClose={() => setShowPdfModal(false)} />}
      {showAddAnnotation && (
        <AddAnnotationModal
          onAdd={(date, label, color) => {
            addAnnotation(date, label, color);
            setShowAddAnnotation(false);
          }}
          onClose={() => setShowAddAnnotation(false)}
        />
      )}
    </div>
  );
}
