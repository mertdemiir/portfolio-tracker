import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFxRates } from '../useFxRates';

/**
 * Mocks `fetch` with a fake Frankfurter response. The returned rates match
 * what /latest?from=<base> returns: rates[X] = X per 1 base.
 */
function mockFrankfurter(base: string, rates: Record<string, number>) {
  const fetchMock = vi.fn(async (url: string) => {
    expect(url).toMatch(new RegExp(`from=${base}`));
    return new Response(
      JSON.stringify({
        base,
        date: '2026-01-01',
        rates,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useFxRates', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fetches rates for USD base (regression: used to short-circuit)', async () => {
    const fetchMock = mockFrankfurter('USD', { EUR: 0.9, GBP: 0.8 });
    const { result } = renderHook(() => useFxRates('USD'));

    await waitFor(() => {
      expect(result.current.fxRates).not.toBeNull();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.fxRates?.base).toBe('USD');
    expect(result.current.fxRates?.rates.EUR).toBe(0.9);
  });

  it('converts EUR amount to USD when base=USD (the core bug)', async () => {
    mockFrankfurter('USD', { EUR: 0.9 });
    const { result } = renderHook(() => useFxRates('USD'));

    await waitFor(() => {
      expect(result.current.fxRates).not.toBeNull();
    });

    // 100 EUR with rate 0.9 EUR/USD → 100 / 0.9 = ~111.11 USD
    const usdValue = result.current.convertToBase(100, 'EUR');
    expect(usdValue).toBeCloseTo(111.11, 1);
  });

  it('converts USD amount to EUR when base=EUR', async () => {
    mockFrankfurter('EUR', { USD: 1.1 });
    const { result } = renderHook(() => useFxRates('EUR'));

    await waitFor(() => {
      expect(result.current.fxRates).not.toBeNull();
    });

    // 100 USD with rate 1.1 USD/EUR → 100 / 1.1 = ~90.91 EUR
    const eurValue = result.current.convertToBase(100, 'USD');
    expect(eurValue).toBeCloseTo(90.91, 1);
  });

  it('passes through when from and base match', async () => {
    mockFrankfurter('USD', { EUR: 0.9 });
    const { result } = renderHook(() => useFxRates('USD'));
    await waitFor(() => expect(result.current.fxRates).not.toBeNull());
    expect(result.current.convertToBase(100, 'USD')).toBe(100);
  });

  it('returns amount unchanged if rates are missing (best-effort fallback)', () => {
    const { result } = renderHook(() => useFxRates('USD'));
    // No fetch completed yet → rates null → passthrough
    expect(result.current.convertToBase(100, 'EUR')).toBe(100);
  });

  it('returns amount unchanged for unknown currency', async () => {
    mockFrankfurter('USD', { EUR: 0.9 });
    const { result } = renderHook(() => useFxRates('USD'));
    await waitFor(() => expect(result.current.fxRates).not.toBeNull());
    // ZZZ not in rates table
    expect(result.current.convertToBase(100, 'ZZZ')).toBe(100);
  });

  it('refetches when baseCurrency changes', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const baseMatch = /from=([A-Z]+)/.exec(url);
      const base = baseMatch?.[1] ?? 'USD';
      return new Response(
        JSON.stringify({
          base,
          date: '2026-01-01',
          rates: base === 'USD' ? { EUR: 0.9 } : { USD: 1.1 },
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ base }) => useFxRates(base), {
      initialProps: { base: 'USD' },
    });
    await waitFor(() => expect(result.current.fxRates?.base).toBe('USD'));

    rerender({ base: 'EUR' });
    await waitFor(() => expect(result.current.fxRates?.base).toBe('EUR'));

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('gracefully handles fetch failure (keeps previous rates)', async () => {
    mockFrankfurter('USD', { EUR: 0.9 });
    const { result } = renderHook(() => useFxRates('USD'));
    await waitFor(() => expect(result.current.fxRates).not.toBeNull());
    const initialRates = result.current.fxRates;

    // Subsequent fetch fails
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );

    await act(async () => {
      await result.current.fetchRates();
    });

    // Rates unchanged
    expect(result.current.fxRates).toEqual(initialRates);
  });
});
