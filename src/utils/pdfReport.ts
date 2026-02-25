import { jsPDF } from 'jspdf';
import { formatCurrency, formatPercent, formatSignedCurrency } from './formatters';
import type { EnrichedHolding, NetWorthSummary, PortfolioSummary, PortfolioSnapshot } from '../types';

interface PdfReportParams {
  netWorthSummary: NetWorthSummary;
  portfolioSummary: PortfolioSummary;
  holdings: EnrichedHolding[];
  snapshots: PortfolioSnapshot[];
  periodLabel: string;
}

export async function generatePdfReport({
  netWorthSummary,
  portfolioSummary,
  holdings,
  snapshots,
  periodLabel,
}: PdfReportParams): Promise<Blob> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 15;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let y = 20;

  // ─── Page 1: Summary ───
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Portfolio Report', margin, y);
  y += 8;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(100);
  pdf.text(`${today} | Period: ${periodLabel}`, margin, y);
  pdf.setTextColor(0);
  y += 12;

  // Net Worth section
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Net Worth Summary', margin, y);
  y += 8;

  const summaryRows = [
    ['Total Net Worth', formatCurrency(netWorthSummary.totalNetWorth)],
    ['Portfolio Value', formatCurrency(netWorthSummary.totalPortfolioValue)],
    ['Other Assets', formatCurrency(netWorthSummary.totalNonPortfolioValue)],
    ['Total Holdings', String(netWorthSummary.holdingCount)],
    ['', ''],
    ['Portfolio P&L', formatSignedCurrency(portfolioSummary.totalGainLoss)],
    ['Portfolio Return', formatPercent(portfolioSummary.totalGainLossPercent)],
    ['Daily Change', formatSignedCurrency(portfolioSummary.totalDailyChange)],
  ];

  pdf.setFontSize(10);
  for (const [label, value] of summaryRows) {
    if (!label) { y += 3; continue; }
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, margin, y);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }
  y += 8;

  // Category breakdown
  if (netWorthSummary.categoryBreakdown.length > 0) {
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Net Worth by Category', margin, y);
    y += 8;

    pdf.setFontSize(10);
    for (const cat of netWorthSummary.categoryBreakdown) {
      pdf.setFont('helvetica', 'normal');
      pdf.text(cat.label, margin, y);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${formatCurrency(cat.value)} (${cat.percentage.toFixed(1)}%)`, pageWidth - margin, y, { align: 'right' });
      y += 6;
    }
  }

  // ─── Page 2: Holdings Table ───
  pdf.addPage();
  y = 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Holdings', margin, y);
  y += 8;

  // Table header
  const cols = [
    { label: 'Symbol', x: margin, w: 25, align: 'left' as const },
    { label: 'Name', x: margin + 25, w: 45, align: 'left' as const },
    { label: 'Value', x: margin + 80, w: 30, align: 'right' as const },
    { label: 'P&L', x: margin + 110, w: 30, align: 'right' as const },
    { label: 'Return', x: margin + 140, w: 25, align: 'right' as const },
    { label: 'Weight', x: margin + 165, w: 20, align: 'right' as const },
  ];

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(100);
  for (const col of cols) {
    pdf.text(col.label, col.align === 'right' ? col.x + col.w : col.x, y, { align: col.align });
  }
  pdf.setTextColor(0);
  y += 2;
  pdf.setDrawColor(200);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 4;

  // Sort holdings by value
  const sortedHoldings = [...holdings].sort((a, b) => b.marketValue - a.marketValue);

  pdf.setFontSize(8);
  for (const h of sortedHoldings) {
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(h.ticker, cols[0].x, y);
    pdf.setFont('helvetica', 'normal');

    // Truncate name
    const maxNameWidth = cols[1].w - 2;
    let displayName = h.name;
    while (pdf.getTextWidth(displayName) > maxNameWidth && displayName.length > 0) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== h.name) displayName += '...';
    pdf.text(displayName, cols[1].x, y);

    pdf.text(formatCurrency(h.marketValue), cols[2].x + cols[2].w, y, { align: 'right' });
    pdf.text(formatSignedCurrency(h.gainLoss), cols[3].x + cols[3].w, y, { align: 'right' });
    pdf.text(formatPercent(h.gainLossPercent), cols[4].x + cols[4].w, y, { align: 'right' });
    pdf.text(`${h.allocation.toFixed(1)}%`, cols[5].x + cols[5].w, y, { align: 'right' });
    y += 5;
  }

  // ─── Page 3: Monthly Performance ───
  if (snapshots.length > 1) {
    pdf.addPage();
    y = 20;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Monthly Performance', margin, y);
    y += 8;

    // Group snapshots by month
    const monthlyData: { month: string; startValue: number; endValue: number }[] = [];
    const byMonth = new Map<string, PortfolioSnapshot[]>();
    for (const s of snapshots) {
      const month = s.date.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(s);
    }

    for (const [month, snaps] of byMonth) {
      const sorted = snaps.sort((a, b) => a.date.localeCompare(b.date));
      monthlyData.push({
        month,
        startValue: sorted[0].netWorthValue,
        endValue: sorted[sorted.length - 1].netWorthValue,
      });
    }

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100);
    pdf.text('Month', margin, y);
    pdf.text('Start', margin + 50, y, { align: 'right' });
    pdf.text('End', margin + 85, y, { align: 'right' });
    pdf.text('Change', margin + 120, y, { align: 'right' });
    pdf.text('Return', margin + 150, y, { align: 'right' });
    pdf.setTextColor(0);
    y += 2;
    pdf.line(margin, y, pageWidth - margin, y);
    y += 4;

    pdf.setFont('helvetica', 'normal');
    for (const m of monthlyData) {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      const change = m.endValue - m.startValue;
      const pct = m.startValue > 0 ? (change / m.startValue) * 100 : 0;
      const label = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      pdf.text(label, margin, y);
      pdf.text(formatCurrency(m.startValue), margin + 50, y, { align: 'right' });
      pdf.text(formatCurrency(m.endValue), margin + 85, y, { align: 'right' });
      pdf.text(formatSignedCurrency(change), margin + 120, y, { align: 'right' });
      pdf.text(formatPercent(pct), margin + 150, y, { align: 'right' });
      y += 5;
    }
  }

  // Footer on each page
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(150);
    pdf.text('Generated by Wealth Tracker', margin, 290);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, 290, { align: 'right' });
    pdf.setTextColor(0);
  }

  return pdf.output('blob');
}
