import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { todayDateString } from '../utils/formatters';
import type { Portfolio } from '../types';
import { DEFAULT_PORTFOLIO_ID } from '../types';

const DEFAULT_PORTFOLIOS: Portfolio[] = [
  { id: DEFAULT_PORTFOLIO_ID, name: 'My Portfolio', createdDate: todayDateString() },
];

export function usePortfolios() {
  const [portfolios, setPortfolios] = useLocalStorage<Portfolio[]>('portfolios', DEFAULT_PORTFOLIOS);
  const [activePortfolioId, setActivePortfolioId] = useLocalStorage<string | 'all'>('active-portfolio', 'all');

  const createPortfolio = useCallback(
    (name: string) => {
      const id = crypto.randomUUID();
      setPortfolios((prev) => [
        ...prev,
        { id, name, createdDate: todayDateString() },
      ]);
      return id;
    },
    [setPortfolios]
  );

  const renamePortfolio = useCallback(
    (id: string, name: string) => {
      setPortfolios((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name } : p))
      );
    },
    [setPortfolios]
  );

  const deletePortfolio = useCallback(
    (id: string) => {
      if (id === DEFAULT_PORTFOLIO_ID) return; // can't delete default
      setPortfolios((prev) => prev.filter((p) => p.id !== id));
      // If active portfolio was deleted, switch to "all"
      setActivePortfolioId((prev) => (prev === id ? 'all' : prev));
    },
    [setPortfolios, setActivePortfolioId]
  );

  return {
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
  };
}
