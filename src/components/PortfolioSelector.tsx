import { usePortfolioContext } from '../context/PortfolioContext';

export function PortfolioSelector() {
  const { portfolios, activePortfolioId, setActivePortfolioId } = usePortfolioContext();

  if (portfolios.length <= 1) return null;

  return (
    <div className="inline-flex items-center gap-0.5 p-1 bg-surface-alt rounded-lg overflow-x-auto">
      <button
        onClick={() => setActivePortfolioId('all')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
          activePortfolioId === 'all'
            ? 'bg-surface-card text-t-primary shadow-sm'
            : 'text-t-muted hover:text-t-secondary'
        }`}
      >
        All
      </button>
      {portfolios.map((p) => (
        <button
          key={p.id}
          onClick={() => setActivePortfolioId(p.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
            activePortfolioId === p.id
              ? 'bg-surface-card text-t-primary shadow-sm'
              : 'text-t-muted hover:text-t-secondary'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
