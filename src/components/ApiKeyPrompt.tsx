import { useState } from 'react';
import { Key, ExternalLink } from 'lucide-react';

interface ApiKeyPromptProps {
  onSave: (key: string) => void;
  onClose?: () => void;
}

export function ApiKeyPrompt({ onSave, onClose }: ApiKeyPromptProps) {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-md w-full">
      <div className="flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-4 mx-auto">
        <Key className="w-6 h-6 text-blue-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
        Finnhub API Key
      </h3>
      <p className="text-slate-500 text-center text-sm mb-4">
        Enter your free Finnhub API key for live stock & ETF prices.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Enter your Finnhub API key"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="flex gap-2 mt-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Skip for now
            </button>
          )}
          <button
            type="submit"
            disabled={!key.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </form>
      <a
        href="https://finnhub.io/register"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mt-3"
      >
        Get a free API key at finnhub.io
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
