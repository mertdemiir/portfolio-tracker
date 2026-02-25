import { usePortfolioContext } from '../context/PortfolioContext';

export function PortfolioSelector() {
  const { portfolios, activePortfolioId, setActivePortfolioId } = usePortfolioContext();

  if (portfolios.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      <button
        onClick={() => setActivePortfolioId('all')}
        className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
          activePortfolioId === 'all'
            ? 'bg-accent text-white'
            : 'text-t-muted hover:bg-surface-alt'
        }`}
      >
        All
      </button>
      {portfolios.map((p) => (
        <button
          key={p.id}
          onClick={() => setActivePortfolioId(p.id)}
          className={`px-3 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
            activePortfolioId === p.id
              ? 'bg-accent text-white'
              : 'text-t-muted hover:bg-surface-alt'
          }`}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}
