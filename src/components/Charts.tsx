import { useState } from 'react';
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

  return (
    <div>
      {hasHoldings ? (
        <>
          {/* Net Worth Section */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-t-primary">Net Worth</h2>
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
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-b-default text-t-muted hover:border-b-input'
                      }`}
                      style={active ? { backgroundColor: config.color, borderColor: config.color } : undefined}
                    >
                      {config.shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-1 mb-4">
            {TIME_RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === r
                    ? 'bg-accent text-white'
                    : 'text-t-muted hover:bg-surface-alt'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <NetWorthLineChart
              snapshots={snapshots}
              milestones={milestones}
              benchmarkData={benchmarkData}
              benchmarkEnabled={benchmarkEnabled}
              timeRange={timeRange}
              annotations={annotations}
              showAnnotations={showAnnotations}
            />
            <CategoryPieChart categoryBreakdown={netWorthSummary.categoryBreakdown} />
          </div>

          {/* Annotations List */}
          {showAnnotations && annotations.length > 0 && (
            <div className="mb-6">
              <AnnotationsList annotations={annotations} onDelete={deleteAnnotation} />
            </div>
          )}

          {/* Drawdown + Rolling Returns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <DrawdownChart snapshots={snapshots} timeRange={timeRange} />
            <RollingReturnsChart snapshots={snapshots} timeRange={timeRange} />
          </div>

          {/* Currency Exposure */}
          <div className="mb-6">
            <CurrencyExposureChart holdings={allEnrichedHoldings} />
          </div>

          {/* Allocation vs Targets */}
          <AllocationTargetChart />
          <div className="mb-6" />

          {/* Portfolio Section */}
          {filteredEnrichedHoldings.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-t-primary mb-4">Portfolio</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <AllocationPieChart holdings={filteredEnrichedHoldings} />
                <GainLossBarChart holdings={filteredEnrichedHoldings} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
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
      <div className="flex justify-end mb-4 mt-6">
        <button
          onClick={() => setShowPdfModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <FileText className="w-4 h-4" />
          Generate Report
        </button>
      </div>

      {/* Monthly/Yearly Summary */}
      <h2 className="text-lg font-semibold text-t-primary mb-4">Summary</h2>
      <MonthlySummary />

      {/* Snapshot History - collapsible */}
      <button
        onClick={() => setShowHistory((v) => !v)}
        className="flex items-center gap-1.5 text-lg font-semibold text-t-primary mt-6 mb-4 hover:text-t-secondary transition-colors"
      >
        {showHistory ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        History
      </button>
      {showHistory && <SnapshotManager />}

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
