import type { Transaction } from '../types';

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
