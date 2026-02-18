import type { StockQuote, FinnhubSearchResult, CoinGeckoSearchResult, Holding, AssetType } from '../types';

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

async function finnhubFetch(endpoint: string, apiKey: string): Promise<Response> {
  const url = `${FINNHUB_BASE}${endpoint}&token=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 429) {
    throw new Error('Rate limit exceeded. Please wait a moment.');
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res;
}

export async function fetchQuote(ticker: string, apiKey: string): Promise<StockQuote> {
  const res = await finnhubFetch(`/quote?symbol=${encodeURIComponent(ticker)}`, apiKey);
  const data = await res.json();

  if (!data.c || data.c === 0) {
    throw new Error(`No price data for ${ticker}`);
  }

  return {
    currentPrice: data.c,
    change: data.d ?? 0,
    changePercent: data.dp ?? 0,
    lastUpdated: Date.now(),
  };
}

export async function searchSymbol(
  query: string,
  apiKey: string,
  assetType: AssetType = 'stock'
): Promise<FinnhubSearchResult[]> {
  const res = await finnhubFetch(
    `/search?q=${encodeURIComponent(query)}`,
    apiKey
  );
  const data = await res.json();
  const allowedTypes = assetType === 'etf'
    ? ['ETP', 'ETF']
    : ['Common Stock'];
  return (data.result ?? [])
    .filter((r: FinnhubSearchResult) => allowedTypes.includes(r.type))
    .slice(0, 8);
}

export async function searchCrypto(query: string): Promise<CoinGeckoSearchResult[]> {
  const res = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`CoinGecko search error: ${res.status}`);
  const data = await res.json();
  return (data.coins ?? []).slice(0, 8).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    symbol: (c.symbol as string).toUpperCase(),
    thumb: c.thumb as string,
    market_cap_rank: c.market_cap_rank as number | null,
  }));
}

export async function fetchCryptoPrice(coinGeckoId: string): Promise<StockQuote> {
  const res = await fetch(
    `${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(coinGeckoId)}&vs_currencies=usd&include_24hr_change=true`
  );
  if (!res.ok) throw new Error(`CoinGecko price error: ${res.status}`);
  const data = await res.json();
  const coin = data[coinGeckoId];
  if (!coin || !coin.usd) throw new Error(`No price data for ${coinGeckoId}`);

  const price = coin.usd as number;
  const changePercent24h = (coin.usd_24h_change as number) ?? 0;
  const change = price * (changePercent24h / 100);

  return {
    currentPrice: price,
    change,
    changePercent: changePercent24h,
    lastUpdated: Date.now(),
  };
}

export async function fetchPriceForHolding(
  holding: Holding,
  apiKey: string
): Promise<StockQuote> {
  switch (holding.assetType) {
    case 'stock':
    case 'etf':
      return fetchQuote(holding.ticker, apiKey);
    case 'crypto':
      if (!holding.coinGeckoId) throw new Error('Missing coinGeckoId');
      return fetchCryptoPrice(holding.coinGeckoId);
    case 'cash':
      return {
        currentPrice: 1,
        change: 0,
        changePercent: 0,
        lastUpdated: Date.now(),
      };
    case 'metal':
    case 'custom':
      return {
        currentPrice: holding.manualPrice ?? holding.buyPrice,
        change: 0,
        changePercent: 0,
        lastUpdated: Date.now(),
      };
    default:
      throw new Error(`Unknown asset type: ${holding.assetType}`);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
