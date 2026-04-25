import type { AssetType, Transaction } from '../types';

/**
 * Given a ledger of buy/sell transactions for a single holding, compute:
 *   - netShares:   total buy shares − total sell shares
 *   - buyPrice:    weighted average of buy-transaction prices
 *                  (0 when there are no buys)
 *
 * Non-buy/sell transaction types (deposit, withdrawal, interest, correction)
 * are ignored here because they do not affect the holding's share count or
 * cost basis. They are tracked separately for cash-ledger holdings.
 *
 * Use this when editing or deleting a transaction to derive the holding's
 * new shares/buyPrice from the source-of-truth ledger rather than applying
 * a delta (which accumulates floating-point drift over many edits).
 */
export function recomputeHoldingFromLedger(
  txns: Array<Pick<Transaction, 'type' | 'shares' | 'pricePerShare'>>,
): { netShares: number; buyPrice: number } {
  let totalBuyShares = 0;
  let totalBuyCost = 0;
  let totalSellShares = 0;
  for (const t of txns) {
    if (t.type === 'buy') {
      totalBuyShares += t.shares;
      totalBuyCost += t.shares * t.pricePerShare;
    } else if (t.type === 'sell') {
      totalSellShares += t.shares;
    }
  }
  return {
    netShares: totalBuyShares - totalSellShares,
    buyPrice: totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0,
  };
}

/**
 * Result of deriving a holding's position purely from its transaction ledger.
 *
 *   shares       —  current units held (buys minus sells; for cash, the full
 *                   ledger including deposits/withdrawals/interest/corrections)
 *   buyPrice     —  weighted-average per-unit buy price (0 if no buys / cash)
 *   buyFxRate    —  weighted-average FX rate at buy time, or undefined if no
 *                   buy txn carries one (the consumer should fall back to a
 *                   live rate as today)
 *   realizedPnl  —  sum over sell txns of (sellPrice − costBasisPerShare)
 *                   × shares, in *transaction currency*. The caller converts
 *                   to base currency.
 *   matchedTxnCount  —  how many txns contributed to the derivation. Useful
 *                       in the validator: 0 means we have a holding with no
 *                       ledger entries at all (orphan).
 */
export interface DerivedHolding {
  shares: number;
  buyPrice: number;
  buyFxRate?: number;
  realizedPnl: number;
  matchedTxnCount: number;
}

/**
 * Pure derivation of a holding's position from the transaction ledger.
 *
 * Asset-type behavior:
 *   - cash:    every txn type affects shares (deposit/interest/correction add,
 *              withdrawal/sell subtract; legacy 'buy' adds — what migration 3
 *              uses for the synthetic backfill). buyPrice is fixed at 1
 *              (cost basis on cash is meaningless).
 *   - other:   only buy/sell affect shares. Cash-ledger txn types attached
 *              to a non-cash holding are ignored (defensive — shouldn't
 *              happen in normal flows).
 *
 * Selection of contributing txns:
 *   - Prefer explicit holdingId match (set by Phase 3 backfill + new flows).
 *   - Fall back to (ticker upper-cased, portfolioId) match for legacy txns
 *     whose holdingId was ambiguous at migration time.
 *
 * Idempotent + deterministic: repeated calls on the same inputs return the
 * same result. The function does not look at the wall clock or any external
 * state.
 */
export function deriveHolding(
  holding: { id: string; ticker: string; portfolioId: string; assetType: AssetType },
  allTransactions: Transaction[],
): DerivedHolding {
  const tickerUpper = holding.ticker.toUpperCase();
  const isCash = holding.assetType === 'cash';

  // Pick contributing transactions. holdingId is preferred when set.
  const contributing = allTransactions.filter((t) => {
    if (t.holdingId) return t.holdingId === holding.id;
    return t.ticker.toUpperCase() === tickerUpper && t.portfolioId === holding.portfolioId;
  });

  let shares = 0;
  let totalBuyShares = 0;
  let totalBuyCost = 0;
  let totalBuyFxWeighted = 0;
  let totalBuyFxWeight = 0;
  let realizedPnl = 0;

  for (const t of contributing) {
    switch (t.type) {
      case 'buy':
        shares += t.shares;
        totalBuyShares += t.shares;
        totalBuyCost += t.shares * t.pricePerShare;
        if (typeof t.buyFxRate === 'number') {
          totalBuyFxWeighted += t.shares * t.buyFxRate;
          totalBuyFxWeight += t.shares;
        }
        break;

      case 'sell':
        shares -= t.shares;
        if (typeof t.costBasisPerShare === 'number') {
          realizedPnl += (t.pricePerShare - t.costBasisPerShare) * t.shares;
        }
        break;

      case 'deposit':
      case 'interest':
        if (isCash) shares += t.shares;
        break;

      case 'withdrawal':
        if (isCash) shares -= t.shares;
        break;

      case 'correction':
        // Stored signed (per CashLedgerModal). Only applies to cash.
        if (isCash) shares += t.shares;
        break;

      default:
        // Defensive: future txn types we don't yet recognize.
        break;
    }
  }

  const buyPrice = isCash
    ? 1
    : totalBuyShares > 0
      ? totalBuyCost / totalBuyShares
      : 0;

  const buyFxRate = totalBuyFxWeight > 0 ? totalBuyFxWeighted / totalBuyFxWeight : undefined;

  return {
    shares,
    buyPrice,
    buyFxRate,
    realizedPnl,
    matchedTxnCount: contributing.length,
  };
}
