import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageAdapter } from '../localStorageAdapter';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
    await adapter.init();
  });

  it('has the correct name for diagnostics', () => {
    expect(adapter.name).toBe('localStorage');
  });

  it('get returns null when a key is missing', async () => {
    expect(await adapter.get('portfolio-holdings')).toBeNull();
  });

  it('set and get round-trip arbitrary JSON', async () => {
    const holdings = [{ id: 'h1', ticker: 'AAPL', shares: 10 }];
    await adapter.set('portfolio-holdings', holdings);
    expect(await adapter.get('portfolio-holdings')).toEqual(holdings);
  });

  it('get returns null on malformed JSON instead of throwing', async () => {
    localStorage.setItem('portfolio-holdings', 'not-json{');
    expect(await adapter.get('portfolio-holdings')).toBeNull();
  });

  it('remove clears the key', async () => {
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    await adapter.remove('portfolio-holdings');
    expect(await adapter.get('portfolio-holdings')).toBeNull();
  });

  it('getAll returns every populated managed key', async () => {
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    await adapter.set('transactions', [{ id: 't1' }]);
    const all = await adapter.getAll();
    expect(all).toEqual({
      'portfolio-holdings': [{ id: 'h1' }],
      transactions: [{ id: 't1' }],
    });
  });

  it('getAll only returns keys from the managed list (ignores settings)', async () => {
    localStorage.setItem('theme', JSON.stringify('dark'));
    localStorage.setItem('app-meta', JSON.stringify({}));
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    const all = await adapter.getAll();
    expect(Object.keys(all)).toEqual(['portfolio-holdings']);
  });

  it('listKeys lists only managed keys that exist', async () => {
    await adapter.set('portfolio-holdings', []);
    await adapter.set('transactions', []);
    localStorage.setItem('theme', JSON.stringify('dark')); // not managed
    const keys = await adapter.listKeys();
    expect(keys.sort()).toEqual(['portfolio-holdings', 'transactions']);
  });

  it('clear removes every managed key but leaves settings alone', async () => {
    await adapter.set('portfolio-holdings', [{ id: 'h1' }]);
    await adapter.set('transactions', [{ id: 't1' }]);
    localStorage.setItem('theme', JSON.stringify('dark'));
    localStorage.setItem('app-meta', JSON.stringify({}));
    await adapter.clear();
    expect(await adapter.get('portfolio-holdings')).toBeNull();
    expect(await adapter.get('transactions')).toBeNull();
    expect(localStorage.getItem('theme')).toBe(JSON.stringify('dark'));
    expect(localStorage.getItem('app-meta')).toBe(JSON.stringify({}));
  });
});
