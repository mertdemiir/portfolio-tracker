import { useState } from 'react';
import { Upload, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { usePortfolioContext } from '../context/PortfolioContext';
import { parseCsv, autoDetectMapping, HOLDING_FIELD_ALIASES, TRANSACTION_FIELD_ALIASES } from '../utils/csvParser';
import { todayDateString } from '../utils/formatters';
import { DEFAULT_PORTFOLIO_ID } from '../types';
import type { CsvImportMode } from '../types';

interface CsvImportModalProps {
  onClose: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'done';

const HOLDING_FIELDS = [
  { key: 'ticker', label: 'Ticker', required: true },
  { key: 'name', label: 'Name', required: false },
  { key: 'shares', label: 'Shares', required: true },
  { key: 'buyPrice', label: 'Buy Price', required: false },
  { key: 'buyDate', label: 'Buy Date', required: false },
  { key: 'assetType', label: 'Asset Type', required: false },
  { key: 'category', label: 'Category', required: false },
];

const TRANSACTION_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'ticker', label: 'Ticker', required: true },
  { key: 'name', label: 'Name', required: false },
  { key: 'type', label: 'Type (Buy/Sell)', required: true },
  { key: 'shares', label: 'Shares', required: true },
  { key: 'pricePerShare', label: 'Price Per Share', required: true },
  { key: 'total', label: 'Total', required: false },
  { key: 'notes', label: 'Notes', required: false },
];

function parseTransactionType(value: string): 'buy' | 'sell' | null {
  const v = value.toLowerCase().trim();
  if (['buy', 'bought', 'purchase', 'long'].includes(v)) return 'buy';
  if (['sell', 'sold', 'sale', 'short'].includes(v)) return 'sell';
  return null;
}

export function CsvImportModal({ onClose }: CsvImportModalProps) {
  const { addHolding, addTransaction } = usePortfolioContext();
  const [mode, setMode] = useState<CsvImportMode>('holdings');
  const [step, setStep] = useState<ImportStep>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const isElectron = !!window.electronAPI;
  const fields = mode === 'holdings' ? HOLDING_FIELDS : TRANSACTION_FIELDS;
  const aliases = mode === 'holdings' ? HOLDING_FIELD_ALIASES : TRANSACTION_FIELD_ALIASES;

  async function handleUpload() {
    let csvText: string | null = null;

    if (isElectron) {
      const result = await window.electronAPI!.importCsv();
      if (result.cancelled || !result.success) return;
      csvText = result.data!;
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return;
      csvText = await file.text();
    }

    const parsed = parseCsv(csvText);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) return;

    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(autoDetectMapping(parsed.headers, aliases));
    setStep('mapping');
  }

  function updateMapping(csvHeader: string, appField: string | null) {
    setMapping((prev) => {
      const next = { ...prev };
      // Clear any other header already mapped to this field
      if (appField) {
        for (const key of Object.keys(next)) {
          if (next[key] === appField) next[key] = null;
        }
      }
      next[csvHeader] = appField;
      return next;
    });
  }

  function getMappedFields(): Set<string> {
    return new Set(Object.values(mapping).filter(Boolean) as string[]);
  }

  function canProceedFromMapping(): boolean {
    const mapped = getMappedFields();
    return fields.filter((f) => f.required).every((f) => mapped.has(f.key));
  }

  function getRowValue(row: Record<string, string>, field: string): string {
    for (const [csvHeader, appField] of Object.entries(mapping)) {
      if (appField === field) return row[csvHeader] ?? '';
    }
    return '';
  }

  function validateRow(row: Record<string, string>): string | null {
    if (mode === 'holdings') {
      const ticker = getRowValue(row, 'ticker').trim();
      const shares = parseFloat(getRowValue(row, 'shares'));
      if (!ticker) return 'Missing ticker';
      if (isNaN(shares) || shares <= 0) return 'Invalid shares';
      return null;
    } else {
      const ticker = getRowValue(row, 'ticker').trim();
      const shares = parseFloat(getRowValue(row, 'shares'));
      const price = parseFloat(getRowValue(row, 'pricePerShare'));
      const type = parseTransactionType(getRowValue(row, 'type'));
      if (!ticker) return 'Missing ticker';
      if (!type) return 'Invalid type (expected Buy/Sell)';
      if (isNaN(shares) || shares <= 0) return 'Invalid shares';
      if (isNaN(price) || price < 0) return 'Invalid price';
      return null;
    }
  }

  function handleImport() {
    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      if (validateRow(row)) {
        skipped++;
        continue;
      }

      if (mode === 'holdings') {
        const ticker = getRowValue(row, 'ticker').trim().toUpperCase();
        const name = getRowValue(row, 'name').trim() || ticker;
        const shares = parseFloat(getRowValue(row, 'shares'));
        const buyPrice = parseFloat(getRowValue(row, 'buyPrice')) || 0;
        const buyDate = getRowValue(row, 'buyDate').trim() || todayDateString();
        const rawAssetType = getRowValue(row, 'assetType').trim().toLowerCase();
        const validTypes = ['stock', 'etf', 'crypto', 'metal', 'cash', 'custom'];
        const mappedAssetType = validTypes.includes(rawAssetType) ? rawAssetType as import('../types').AssetType : 'stock';
        const rawCategory = getRowValue(row, 'category').trim();
        const mappedCategory = rawCategory || (() => {
          switch (mappedAssetType) {
            case 'stock': case 'etf': case 'crypto': return 'investments';
            case 'metal': return 'precious-metals';
            case 'cash': return 'cash-savings';
            default: return 'other';
          }
        })();
        addHolding({
          ticker,
          name,
          shares,
          buyPrice,
          buyDate,
          assetType: mappedAssetType,
          inPortfolio: true,
          category: mappedCategory,
          portfolioId: DEFAULT_PORTFOLIO_ID,
        });
        imported++;
      } else {
        const ticker = getRowValue(row, 'ticker').trim().toUpperCase();
        const name = getRowValue(row, 'name').trim() || ticker;
        const date = getRowValue(row, 'date').trim() || todayDateString();
        const type = parseTransactionType(getRowValue(row, 'type'))!;
        const shares = parseFloat(getRowValue(row, 'shares'));
        const pricePerShare = parseFloat(getRowValue(row, 'pricePerShare'));
        const totalRaw = parseFloat(getRowValue(row, 'total'));
        const total = isNaN(totalRaw) ? shares * pricePerShare : totalRaw;
        const notes = getRowValue(row, 'notes').trim() || undefined;
        addTransaction({ date, ticker, name, type, shares, pricePerShare, total, notes, portfolioId: DEFAULT_PORTFOLIO_ID });
        imported++;
      }
    }

    setImportedCount(imported);
    setSkippedCount(skipped);
    setStep('done');
  }

  const validRows = rows.filter((r) => !validateRow(r));

  return (
    <Modal title="Import CSV" onClose={onClose} size="2xl">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6 text-xs text-t-muted">
          {['Upload', 'Map Columns', 'Preview', 'Done'].map((label, i) => {
            const stepNames: ImportStep[] = ['upload', 'mapping', 'preview', 'done'];
            const isActive = step === stepNames[i];
            const isDone = stepNames.indexOf(step) > i;
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <ChevronRight size={12} />}
                <span className={`font-medium ${isActive ? 'text-accent' : isDone ? 'text-gain' : ''}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <div className="flex bg-surface-alt rounded-lg p-0.5 w-fit mb-6">
              {(['holdings', 'transactions'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                    mode === m ? 'bg-surface-card text-t-primary shadow-sm' : 'text-t-muted hover:text-t-secondary'
                  }`}
                >{m}</button>
              ))}
            </div>
            <div className="border-2 border-dashed border-b-input card-radius p-10 text-center">
              <Upload className="w-10 h-10 text-t-faint mx-auto mb-3" />
              <p className="text-sm text-t-muted mb-4">
                Upload a CSV file with your {mode === 'holdings' ? 'holdings' : 'transactions'} data.
              </p>
              <button
                onClick={handleUpload}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                <Upload size={16} />
                Choose CSV File
              </button>
            </div>
          </div>
        )}

        {/* Step: Column Mapping */}
        {step === 'mapping' && (
          <div>
            <p className="text-sm text-t-muted mb-4">
              Map your CSV columns to the app fields. {rows.length} rows found.
            </p>
            <div className="space-y-3 mb-6">
              {headers.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <span className="text-sm text-t-secondary w-40 truncate font-medium" title={header}>
                    {header}
                  </span>
                  <ChevronRight size={14} className="text-t-faint flex-shrink-0" />
                  <select
                    value={mapping[header] ?? ''}
                    onChange={(e) => updateMapping(header, e.target.value || null)}
                    className="flex-1 px-3 py-1.5 border border-b-input rounded-lg text-sm"
                  >
                    <option value="">Skip</option>
                    {fields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label} {f.required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!canProceedFromMapping() && (
              <p className="text-sm text-amber-500 mb-4 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Map all required fields (*) to continue.
              </p>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm text-t-muted hover:bg-surface-alt rounded-lg">
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                disabled={!canProceedFromMapping()}
                className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                Preview
              </button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div>
            <p className="text-sm text-t-muted mb-4">
              {validRows.length} of {rows.length} rows valid and ready to import.
              {rows.length - validRows.length > 0 && (
                <> <span className="text-amber-600 dark:text-amber-400">{rows.length - validRows.length} will be skipped due to errors.</span></>
              )}
            </p>
            <div className="overflow-x-auto mb-6 max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-b-default text-left">
                    <th className="pb-2 pr-3 font-medium text-t-muted">Status</th>
                    {fields.filter((f) => getMappedFields().has(f.key)).map((f) => (
                      <th key={f.key} className="pb-2 pr-3 font-medium text-t-muted">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, i) => {
                    const error = validateRow(row);
                    return (
                      <tr key={i} className={`border-b border-b-subtle ${error ? 'bg-loss-bg' : ''}`}>
                        <td className="py-1.5 pr-3">
                          {error ? (
                            <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={12} />{error}</span>
                          ) : (
                            <Check size={12} className="text-emerald-500" />
                          )}
                        </td>
                        {fields.filter((f) => getMappedFields().has(f.key)).map((f) => (
                          <td key={f.key} className="py-1.5 pr-3 text-t-secondary truncate max-w-[100px]">
                            {getRowValue(row, f.key) || '-'}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 50 && (
                <p className="text-xs text-t-faint mt-2">
                  Preview shows first 50 rows. {rows.length - 50} more row{rows.length - 50 === 1 ? '' : 's'} will be imported.
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep('mapping')} className="px-4 py-2 text-sm text-t-muted hover:bg-surface-alt rounded-lg">
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={validRows.length === 0}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                Import {validRows.length} {mode === 'holdings' ? 'Holdings' : 'Transactions'}
              </button>
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gain-bg flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-gain" />
            </div>
            <h3 className="text-lg font-semibold text-t-primary mb-2">Import Complete</h3>
            <p className="text-sm text-t-muted mb-1">
              Successfully imported <span className="font-semibold">{importedCount}</span> {mode}.
            </p>
            {skippedCount > 0 && (
              <p className="text-sm text-amber-500">
                {skippedCount} row{skippedCount > 1 ? 's' : ''} skipped due to validation errors.
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-colors"
            >
              Done
            </button>
          </div>
        )}
    </Modal>
  );
}
