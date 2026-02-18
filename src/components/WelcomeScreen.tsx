import { useState } from 'react';
import { Key, ExternalLink, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onSaveKey: (key: string) => void;
  onSkip: () => void;
}

export function WelcomeScreen({ onSaveKey, onSkip }: WelcomeScreenProps) {
  const [keyInput, setKeyInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (trimmed) {
      onSaveKey(trimmed);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 rounded-xl mb-4">
            <Key className="w-7 h-7 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Portfolio Tracker</h1>
          <p className="text-sm text-slate-500">
            To get live stock & ETF prices, you'll need a free Finnhub API key.
          </p>
        </div>

        <a
          href="https://finnhub.io/register"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors mb-4"
        >
          Get your free Finnhub API key
          <ExternalLink className="w-4 h-4" />
        </a>

        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Paste your API key here"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!keyInput.trim()}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Save & continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Skip for now — crypto prices still work without a key
          </button>
        </div>
      </div>
    </div>
  );
}
