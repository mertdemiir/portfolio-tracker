import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useExchangeRate } from '../useExchangeRate';

function mockFrankfurter(rate: number) {
  const fetchMock = vi.fn(async (url: string) => {
    // Respond with rates[to] extracted from the query
    const match = /to=([A-Z]+)/.exec(url);
    const to = match?.[1] ?? 'TRY';
    return new Response(
      JSON.stringify({ base: 'USD', date: '2026-01-01', rates: { [to]: rate } }),
      { status: 200 }
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('useExchangeRate', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 1 immediately when from === to', () => {
    const { result } = renderHook(() => useExchangeRate('USD', 'USD'));
    expect(result.current).toBe(1);
  });

  it('fetches and caches the rate on first call', async () => {
    const fetchMock = mockFrankfurter(30);
    const { result } = renderHook(() => useExchangeRate('USD', 'TRY'));
    await waitFor(() => expect(result.current).toBe(30));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const cached = JSON.parse(localStorage.getItem('exchange-rate:USD:TRY') || 'null');
    expect(cached.rate).toBe(30);
  });

  it('reads from cache on mount when fresh (does not fetch)', async () => {
    localStorage.setItem(
      'exchange-rate:USD:TRY',
      JSON.stringify({ rate: 35, fetchedAt: Date.now() })
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useExchangeRate('USD', 'TRY'));
    // Returns cached rate synchronously
    expect(result.current).toBe(35);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refetches when cache is older than 1 hour', async () => {
    const oneHourAndOne = Date.now() - 60 * 60 * 1000 - 1;
    localStorage.setItem(
      'exchange-rate:USD:TRY',
      JSON.stringify({ rate: 35, fetchedAt: oneHourAndOne })
    );
    const fetchMock = mockFrankfurter(40);
    const { result } = renderHook(() => useExchangeRate('USD', 'TRY'));
    // Starts with stale value
    expect(result.current).toBe(35);
    await waitFor(() => expect(result.current).toBe(40));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when no cache and fetch in flight', () => {
    // Fetch hangs forever
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { result } = renderHook(() => useExchangeRate('USD', 'TRY'));
    expect(result.current).toBeNull();
  });

  it('keeps cached rate on fetch failure', async () => {
    localStorage.setItem(
      'exchange-rate:USD:TRY',
      JSON.stringify({ rate: 35, fetchedAt: Date.now() - 2 * 60 * 60 * 1000 })
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const { result } = renderHook(() => useExchangeRate('USD', 'TRY'));
    expect(result.current).toBe(35);
    // Still 35 after (failed) fetch attempt
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current).toBe(35);
  });
});
