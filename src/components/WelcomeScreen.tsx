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
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-surface-card rounded-2xl shadow-lg w-full max-w-md p-8 animate-modal-enter">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-light card-radius mb-4">
            <Key className="w-7 h-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-t-primary mb-2">Welcome to Portfolio Tracker</h1>
          <p className="text-sm text-t-muted">
            To get live stock & ETF prices, you'll need a free Finnhub API key.
          </p>
        </div>

        <a
          href="https://finnhub.io/register"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors mb-4"
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
            className="w-full px-4 py-3 border border-b-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
          />
          <button
            type="submit"
            disabled={!keyInput.trim()}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-40 transition-colors"
          >
            Save & continue
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center">
          <button
            onClick={onSkip}
            className="text-sm text-t-faint hover:text-t-muted transition-colors"
          >
            Skip for now — crypto prices still work without a key
          </button>
        </div>
      </div>
    </div>
  );
}
