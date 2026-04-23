import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { generatePdfReport } from '../utils/pdfReport';
import { parseLocalDate } from '../utils/dateHelpers';
import type { ReportPeriod } from '../types';

interface PdfReportModalProps {
  onClose: () => void;
}

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-quarter', label: 'Last Quarter' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'all-time', label: 'All Time' },
];

export function PdfReportModal({ onClose }: PdfReportModalProps) {
  const {
    netWorthSummary,
    portfolioSummary,
    allEnrichedHoldings,
    snapshots,
  } = usePortfolioContext();

  const [period, setPeriod] = useState<ReportPeriod>('all-time');
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const periodLabel = PERIODS.find((p) => p.value === period)?.label || 'All Time';

      // Filter snapshots by period. Parse s.date via parseLocalDate so the
      // comparison doesn't drift by a day due to UTC interpretation.
      let filteredSnapshots = snapshots;
      const now = new Date();
      const cutoff = new Date(now);
      switch (period) {
        case 'last-month':
          cutoff.setMonth(cutoff.getMonth() - 1);
          break;
        case 'last-quarter':
          cutoff.setMonth(cutoff.getMonth() - 3);
          break;
        case 'last-year':
          cutoff.setFullYear(cutoff.getFullYear() - 1);
          break;
      }
      if (period !== 'all-time') {
        filteredSnapshots = snapshots.filter((s) => parseLocalDate(s.date) >= cutoff);
      }

      const blob = await generatePdfReport({
        netWorthSummary,
        portfolioSummary,
        holdings: allEnrichedHoldings,
        snapshots: filteredSnapshots,
        periodLabel,
      });

      const isElectron = !!window.electronAPI;
      if (isElectron) {
        const arrayBuffer = await blob.arrayBuffer();
        await window.electronAPI!.savePdf(arrayBuffer);
      } else {
        // Browser: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('PDF generation failed', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" aria-hidden="true" />
          Generate PDF Report
        </span>
      }
      onClose={onClose}
      size="sm"
    >
      <div className="mb-4">
          <label className="block text-sm font-medium text-t-secondary mb-2">Report Period</label>
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  period === p.value
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-b-default text-t-muted hover:border-b-input'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-t-faint mb-4">
          Includes: portfolio summary, all holdings, category breakdown, and monthly performance.
        </p>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {generating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" aria-hidden="true" />
              Generate Report
            </>
          )}
        </button>
    </Modal>
  );
}
