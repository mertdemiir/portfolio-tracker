import { usePortfolioContext } from '../context/PortfolioContext';
import { AllocationPieChart } from './AllocationPieChart';
import { GainLossBarChart } from './GainLossBarChart';
import { PortfolioLineChart } from './PortfolioLineChart';
import { NetWorthLineChart } from './NetWorthLineChart';
import { CategoryPieChart } from './CategoryPieChart';

export function Charts() {
  const {
    allEnrichedHoldings,
    portfolioEnrichedHoldings,
    netWorthSummary,
    snapshots,
  } = usePortfolioContext();

  if (allEnrichedHoldings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
        <p>Add holdings to see charts.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Net Worth Section */}
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Net Worth</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <NetWorthLineChart snapshots={snapshots} />
        <CategoryPieChart categoryBreakdown={netWorthSummary.categoryBreakdown} />
      </div>

      {/* Portfolio Section */}
      {portfolioEnrichedHoldings.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Portfolio</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <AllocationPieChart holdings={portfolioEnrichedHoldings} />
            <GainLossBarChart holdings={portfolioEnrichedHoldings} />
          </div>
          <PortfolioLineChart snapshots={snapshots} />
        </>
      )}
    </div>
  );
}
