import { describe, it, expect, beforeEach } from 'vitest';
import { runMigrations } from '../migrations';
import { readAppMeta, writeAppMeta } from '../schema';

/**
 * Integration test for schema migration 3: Transactions first-class.
 *
 * The migration does two things:
 *   (a) For every Holding without a matching buy Transaction in the
 *       same (ticker, portfolioId) scope, synthesize one using the
 *       holding's buyPrice/shares/buyDate and flag it synthetic: true.
 *   (b) Backfill holdingId on existing Transactions where exactly one
 *       holding matches on (ticker, portfolioId).
 */
describe('migration 3 — transactions first-class', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setMetaAtVersion2() {
    writeAppMeta({
      schemaVersion: 2,
      lastAppVersion: '1.2.0',
      lastBackupAt: null,
      history: [],
      preUpdateAckVersion: '1.2.0',
      dataBackend: 'localStorage',
    });
  }

  it('synthesizes a buy transaction for a holding that has no matching buy', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        {
          id: 'h1',
          ticker: 'AAPL',
          name: 'Apple',
          shares: 10,
          buyPrice: 150,
          buyDate: '2024-01-15',
          assetType: 'stock',
          category: 'investments',
          currency: 'USD',
          portfolioId: 'default',
        },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    const result = await runMigrations();
    expect(result.failed).toBeNull();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    expect(txns).toHaveLength(1);
    const syn = txns[0];
    expect(syn.type).toBe('buy');
    expect(syn.synthetic).toBe(true);
    expect(syn.holdingId).toBe('h1');
    expect(syn.ticker).toBe('AAPL');
    expect(syn.shares).toBe(10);
    expect(syn.pricePerShare).toBe(150);
    expect(syn.total).toBe(1500);
    expect(syn.date).toBe('2024-01-15');
    expect(syn.portfolioId).toBe('default');
  });

  it('does NOT synthesize a buy when a matching buy already exists', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150, buyDate: '2024-01-15', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        {
          id: 't1',
          date: '2024-01-15',
          ticker: 'AAPL',
          name: 'Apple',
          type: 'buy',
          shares: 10,
          pricePerShare: 150,
          total: 1500,
          portfolioId: 'default',
        },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    expect(txns).toHaveLength(1);
    expect(txns[0].synthetic).toBeUndefined();
    // holdingId backfilled on existing txn
    expect(txns[0].holdingId).toBe('h1');
  });

  it('backfills holdingId on existing transactions when match is unambiguous', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150, buyDate: '2024-01-15', portfolioId: 'default' },
        { id: 'h2', ticker: 'TSLA', name: 'Tesla', shares: 5, buyPrice: 200, buyDate: '2024-02-20', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-01-15', ticker: 'AAPL', name: 'Apple', type: 'buy', shares: 10, pricePerShare: 150, total: 1500, portfolioId: 'default' },
        { id: 't2', date: '2024-02-20', ticker: 'TSLA', name: 'Tesla', type: 'buy', shares: 5, pricePerShare: 200, total: 1000, portfolioId: 'default' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const t1 = txns.find((t: { id: string }) => t.id === 't1');
    const t2 = txns.find((t: { id: string }) => t.id === 't2');
    expect(t1.holdingId).toBe('h1');
    expect(t2.holdingId).toBe('h2');
  });

  it('does NOT overwrite a holdingId that is already present', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150, buyDate: '2024-01-15', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-01-15', ticker: 'AAPL', name: 'Apple', type: 'buy', shares: 10, pricePerShare: 150, total: 1500, portfolioId: 'default', holdingId: 'pre-existing-id' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    expect(txns[0].holdingId).toBe('pre-existing-id');
  });

  it('leaves holdingId unfilled when multiple holdings share the same (ticker, portfolioId)', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150, buyDate: '2024-01-15', portfolioId: 'default' },
        { id: 'h2', ticker: 'AAPL', name: 'Apple', shares: 5,  buyPrice: 180, buyDate: '2024-02-15', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-01-15', ticker: 'AAPL', name: 'Apple', type: 'buy', shares: 10, pricePerShare: 150, total: 1500, portfolioId: 'default' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    const t1 = txns.find((t: { id: string }) => t.id === 't1');
    expect(t1.holdingId).toBeUndefined();
  });

  it('is idempotent: running again after completion is a no-op', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150, buyDate: '2024-01-15', portfolioId: 'default' },
      ]),
    );
    localStorage.setItem('transactions', JSON.stringify([]));

    await runMigrations();
    const afterFirstRun = localStorage.getItem('transactions');

    const r2 = await runMigrations();
    expect(r2.ran).toHaveLength(0);
    expect(localStorage.getItem('transactions')).toBe(afterFirstRun);
  });

  it('records the migration in app-meta.history with success=true', async () => {
    setMetaAtVersion2();
    localStorage.setItem('portfolio-holdings', JSON.stringify([]));
    localStorage.setItem('transactions', JSON.stringify([]));

    await runMigrations();

    const meta = readAppMeta();
    expect(meta.schemaVersion).toBeGreaterThanOrEqual(3);
    const v3Record = meta.history.find((h) => h.toVersion === 3);
    expect(v3Record).toBeDefined();
    expect(v3Record?.success).toBe(true);
    expect(v3Record?.backupKey).toMatch(/^__pre_migration_2_to_3_/);
  });

  it('tolerates malformed holdings/transactions data without crashing', async () => {
    setMetaAtVersion2();
    localStorage.setItem('portfolio-holdings', 'not-json');
    localStorage.setItem('transactions', JSON.stringify({ not: 'an-array' }));

    const result = await runMigrations();
    expect(result.failed).toBeNull();
    expect(result.finalVersion).toBeGreaterThanOrEqual(3);
  });

  it('scopes synthetic-buy check by portfolioId (two buckets, same ticker)', async () => {
    setMetaAtVersion2();
    localStorage.setItem(
      'portfolio-holdings',
      JSON.stringify([
        { id: 'h1', ticker: 'AAPL', name: 'Apple', shares: 10, buyPrice: 150, buyDate: '2024-01-15', portfolioId: 'default' },
        { id: 'h2', ticker: 'AAPL', name: 'Apple', shares: 5,  buyPrice: 180, buyDate: '2024-02-15', portfolioId: 'work-401k' },
      ]),
    );
    // Only a buy for bucket "default" exists. "work-401k" needs a synthetic.
    localStorage.setItem(
      'transactions',
      JSON.stringify([
        { id: 't1', date: '2024-01-15', ticker: 'AAPL', name: 'Apple', type: 'buy', shares: 10, pricePerShare: 150, total: 1500, portfolioId: 'default' },
      ]),
    );

    await runMigrations();

    const txns = JSON.parse(localStorage.getItem('transactions')!);
    expect(txns).toHaveLength(2);
    const synthetic = txns.find((t: { synthetic?: boolean }) => t.synthetic);
    expect(synthetic.portfolioId).toBe('work-401k');
    expect(synthetic.holdingId).toBe('h2');
  });
});
