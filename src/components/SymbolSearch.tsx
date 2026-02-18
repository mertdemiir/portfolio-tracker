import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchSymbol } from '../utils/api';
import type { FinnhubSearchResult, AssetType } from '../types';

interface SymbolSearchProps {
  apiKey: string;
  onSelect: (symbol: string, name: string) => void;
  initialValue?: string;
  assetType?: AssetType;
}

export function SymbolSearch({ apiKey, onSelect, initialValue = '', assetType = 'stock' }: SymbolSearchProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<FinnhubSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  const label = assetType === 'etf' ? 'ETF Symbol' : 'Stock Symbol';
  const placeholder = assetType === 'etf' ? 'Search ETF (e.g. SPY)' : 'Search ticker (e.g. AAPL)';

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchSymbol(query, apiKey, assetType);
        setResults(res);
        setIsOpen(res.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, apiKey, assetType]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value.toUpperCase())}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <li key={r.symbol}>
              <button
                type="button"
                onClick={() => {
                  setQuery(r.symbol);
                  setIsOpen(false);
                  onSelect(r.symbol, r.description);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between text-sm"
              >
                <span className="font-medium text-slate-900">{r.displaySymbol}</span>
                <span className="text-slate-500 text-xs truncate ml-2 max-w-[200px]">
                  {r.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
