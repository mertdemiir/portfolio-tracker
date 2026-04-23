import { useState, useRef, useEffect, useCallback } from 'react';
import { Download, EyeOff, Eye } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Modal } from './Modal';
import { ShareCard } from './ShareCard';
import { usePortfolioContext } from '../context/PortfolioContext';
import type { EnrichedHolding, NetWorthSummary, PortfolioSummary } from '../types';

interface ShareImageModalProps {
  netWorthSummary: NetWorthSummary;
  portfolioSummary: PortfolioSummary;
  topHoldings: EnrichedHolding[];
  onClose: () => void;
}

export function ShareImageModal({ netWorthSummary, portfolioSummary, topHoldings, onClose }: ShareImageModalProps) {
  const { theme } = usePortfolioContext();
  const cardRef = useRef<HTMLDivElement>(null);
  const [anonymize, setAnonymize] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      // Wait for render
      await new Promise((r) => setTimeout(r, 100));
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        logging: false,
      });
      setImageUrl(canvas.toDataURL('image/png'));
    } catch {
      // silently fail
    } finally {
      setCapturing(false);
    }
  }, []);

  useEffect(() => {
    capture();
  }, [capture, anonymize]);

  function handleDownload() {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.download = `portfolio-snapshot-${new Date().toISOString().split('T')[0]}.png`;
    link.href = imageUrl;
    link.click();
  }

  return (
    <Modal title="Share Portfolio Snapshot" onClose={onClose} size="2xl">
        {/* Hidden render target */}
        <div style={{ position: 'absolute', left: -9999, top: 0 }}>
          <ShareCard
            ref={cardRef}
            netWorthSummary={netWorthSummary}
            portfolioSummary={portfolioSummary}
            topHoldings={topHoldings}
            anonymize={anonymize}
            theme={theme}
          />
        </div>

        {/* Preview */}
        <div className="flex justify-center mb-4">
          {imageUrl ? (
            <img src={imageUrl} alt="Portfolio snapshot" className="card-radius shadow-lg max-w-full" style={{ maxHeight: 320 }} />
          ) : (
            <div className="w-full h-48 bg-surface-alt card-radius flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-b-input border-t-accent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setAnonymize(!anonymize)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-t-secondary hover:bg-surface-alt rounded-lg transition-colors"
          >
            {anonymize ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {anonymize ? 'Show amounts' : 'Hide amounts'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!imageUrl || capturing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download PNG
          </button>
        </div>
    </Modal>
  );
}
