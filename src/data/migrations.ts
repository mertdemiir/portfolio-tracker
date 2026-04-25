/**
 * Migration runner.
 *
 * Each migration is a function that takes no args and advances the stored
 * schema by one version. Migrations MUST be idempotent: running them twice
 * produces the same result as running them once. Before running any
 * migration, the runner writes a full backup of localStorage to
 * `__pre_migration_<fromVersion>_to_<toVersion>_<timestamp>` so we can roll
 * back manually if something goes wrong.
 *
 * Registering a new migration:
 *   1. Bump CURRENT_SCHEMA_VERSION in schema.ts.
 *   2. Add an entry to the MIGRATIONS array below with the new version as key.
 *   3. Write the migration function — keep it idempotent and small.
 *   4. Add a unit test.
 */

import {
  APP_META_KEY,
  CURRENT_SCHEMA_VERSION,
  readAppMeta,
  updateAppMeta,
  type MigrationRecord,
} from './schema';
import { gatherBackupData, serializeBackup } from './backup';
import { deriveHolding } from '../utils/transactionLedger';
import type { AssetType, Transaction } from '../types';

/** A migration function advances the schema by exactly one version. */
export type Migration = () => void | Promise<void>;

/**
 * Registered migrations, keyed by the version they produce.
 * E.g. MIGRATIONS[1] advances the schema from version 0 to version 1.
 */
const MIGRATIONS: Record<number, Migration> = {
  /**
   * v0 → v1: Normalize portfolioId.
   *
   * Every Holding and Transaction previously allowed portfolioId to be
   * undefined, with `|| DEFAULT_PORTFOLIO_ID` fallbacks smeared across
   * hooks, context, and modals. This migration fills in the default so
   * the type can be tightened to `portfolioId: string` (non-optional)
   * post-migration.
   *
   * Idempotent: re-running it on already-normalized data is a no-op.
   * Touches only the portfolioId field; no other data is modified.
   */
  1: () => {
    const DEFAULT_PORTFOLIO_ID = 'default';

    // Holdings
    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const holdings = JSON.parse(raw);
        if (Array.isArray(holdings)) {
          let changed = false;
          for (const h of holdings) {
            if (h && typeof h === 'object' && (h.portfolioId === undefined || h.portfolioId === null || h.portfolioId === '')) {
              h.portfolioId = DEFAULT_PORTFOLIO_ID;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem('portfolio-holdings', JSON.stringify(holdings));
          }
        }
      }
    } catch {
      // Non-fatal: malformed data gets left alone. The app's own defensive
      // reads handle whatever shape it's in.
    }

    // Transactions
    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const txns = JSON.parse(raw);
        if (Array.isArray(txns)) {
          let changed = false;
          for (const t of txns) {
            if (t && typeof t === 'object' && (t.portfolioId === undefined || t.portfolioId === null || t.portfolioId === '')) {
              t.portfolioId = DEFAULT_PORTFOLIO_ID;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem('transactions', JSON.stringify(txns));
          }
        }
      }
    } catch {
      // Non-fatal
    }
  },

  /**
   * v2 → v3: Transactions become first-class.
   *
   * Two responsibilities:
   *   (a) For every Holding that has no buy Transaction in the same
   *       (ticker, portfolioId) scope, synthesize one using the holding's
   *       current buyPrice/shares/buyDate. Mark it `synthetic: true`.
   *       This establishes 1:1 parity so a future release can make the
   *       ledger authoritative without losing positions.
   *   (b) Backfill `holdingId` on every existing Transaction where
   *       exactly one holding matches on (ticker, portfolioId). Ambiguous
   *       matches are left as-is — the app's ticker-match fallback still
   *       works for them.
   *
   * Idempotent: the synthetic backfill skips holdings that already have
   * any buy Transaction in scope (including a previously-inserted
   * synthetic one), so re-running the migration is a no-op. The holdingId
   * backfill only writes when the field is currently absent.
   *
   * Non-fatal: malformed data gets skipped rather than thrown. Any
   * throw here would block the migration runner and leave the user on v2.
   */
  3: () => {
    // Tiny UUID generator (RFC4122 v4-ish, crypto-backed when available).
    const makeId = (): string => {
      const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      // Fallback: timestamp + random (sufficient — we only need local uniqueness).
      return `syn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    type RawHolding = {
      id: string;
      ticker?: unknown;
      name?: unknown;
      shares?: unknown;
      buyPrice?: unknown;
      buyDate?: unknown;
      assetType?: unknown;
      category?: unknown;
      currency?: unknown;
      buyFxRate?: unknown;
      portfolioId?: unknown;
    };

    type RawTxn = {
      id?: string;
      ticker?: unknown;
      type?: unknown;
      portfolioId?: unknown;
      holdingId?: unknown;
      synthetic?: unknown;
    };

    let holdings: RawHolding[] = [];
    let txns: (RawTxn & Record<string, unknown>)[] = [];

    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) holdings = parsed;
      }
    } catch {
      // malformed — leave alone
      return;
    }

    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {
      // malformed — leave alone
      return;
    }

    // ── (a) Backfill synthetic buys ─────────────────────────────────
    // Index existing buys by (ticker upper, portfolioId).
    const buyIndex = new Map<string, RawTxn[]>();
    const keyFor = (ticker: unknown, portfolioId: unknown): string => {
      const t = typeof ticker === 'string' ? ticker.toUpperCase() : '';
      const p = typeof portfolioId === 'string' ? portfolioId : 'default';
      return `${t}::${p}`;
    };

    for (const t of txns) {
      if (t && t.type === 'buy') {
        const k = keyFor(t.ticker, t.portfolioId);
        const list = buyIndex.get(k) ?? [];
        list.push(t);
        buyIndex.set(k, list);
      }
    }

    let addedSynthetic = 0;
    for (const h of holdings) {
      if (!h || typeof h !== 'object' || typeof h.id !== 'string') continue;
      if (typeof h.ticker !== 'string') continue;

      const k = keyFor(h.ticker, h.portfolioId);
      if (buyIndex.has(k)) continue; // already has a buy — skip

      const shares = typeof h.shares === 'number' ? h.shares : 0;
      const buyPrice = typeof h.buyPrice === 'number' ? h.buyPrice : 0;
      const buyDate = typeof h.buyDate === 'string' && h.buyDate
        ? h.buyDate
        : new Date().toISOString().slice(0, 10);
      const portfolioId = typeof h.portfolioId === 'string' && h.portfolioId
        ? h.portfolioId
        : 'default';

      const synthetic: Record<string, unknown> = {
        id: makeId(),
        date: buyDate,
        ticker: h.ticker,
        name: typeof h.name === 'string' ? h.name : h.ticker,
        type: 'buy',
        shares,
        pricePerShare: buyPrice,
        total: shares * buyPrice,
        portfolioId,
        holdingId: h.id,
        synthetic: true,
      };
      if (typeof h.assetType === 'string') synthetic.assetType = h.assetType;
      if (typeof h.category === 'string') synthetic.category = h.category;
      if (typeof h.currency === 'string') synthetic.currency = h.currency;
      if (typeof h.buyFxRate === 'number') synthetic.buyFxRate = h.buyFxRate;

      txns.push(synthetic);
      // Update the index so duplicate holdings in the same bucket don't
      // each get their own synthetic buy — the first one wins.
      buyIndex.set(k, [synthetic as RawTxn]);
      addedSynthetic++;
    }

    // ── (b) Backfill holdingId on existing Transactions ────────────
    // Index holdings by (ticker upper, portfolioId). If >1 holding
    // shares the key we refuse to backfill that bucket (ambiguous).
    const holdingIndex = new Map<string, RawHolding[]>();
    for (const h of holdings) {
      if (!h || typeof h.id !== 'string' || typeof h.ticker !== 'string') continue;
      const k = keyFor(h.ticker, h.portfolioId);
      const list = holdingIndex.get(k) ?? [];
      list.push(h);
      holdingIndex.set(k, list);
    }

    let addedHoldingId = 0;
    for (const t of txns) {
      if (!t || typeof t !== 'object') continue;
      if (typeof t.holdingId === 'string' && t.holdingId) continue; // already backfilled
      const k = keyFor(t.ticker, t.portfolioId);
      const matches = holdingIndex.get(k);
      if (!matches || matches.length !== 1) continue; // 0 or ambiguous
      t.holdingId = matches[0].id;
      addedHoldingId++;
    }

    // Only write back if something actually changed.
    if (addedSynthetic > 0 || addedHoldingId > 0) {
      try {
        localStorage.setItem('transactions', JSON.stringify(txns));
      } catch {
        // Storage full or unavailable — surface via throw so the migration
        // runner records a failure rather than silently advancing.
        throw new Error('v3: failed to write transactions back to localStorage');
      }
    }
  },

  /**
   * v1 → v2: Unify watchlist-price-cache into price-cache.
   *
   * Before: the watchlist maintained its own separate price cache at
   * localStorage['watchlist-price-cache']. If the same ticker was in
   * both portfolio and watchlist, we'd fetch the price twice.
   *
   * After: the watchlist shares the portfolio's `price-cache`. This
   * migration copies every entry from watchlist-price-cache into
   * price-cache (portfolio's cache wins on conflict because its data
   * is typically fresher — portfolio holdings drive the 5-min refresh
   * loop), then deletes the watchlist cache key.
   *
   * Idempotent: if watchlist-price-cache is missing or empty, it's a
   * no-op. Running twice after migration leaves the unified cache
   * unchanged (second run finds no watchlist key to merge).
   */
  2: () => {
    try {
      const rawWatchlist = localStorage.getItem('watchlist-price-cache');
      if (!rawWatchlist) return;
      const watchlistCache = JSON.parse(rawWatchlist);
      if (!watchlistCache || typeof watchlistCache !== 'object') {
        // Corrupted — just delete the key.
        localStorage.removeItem('watchlist-price-cache');
        return;
      }

      const rawPortfolio = localStorage.getItem('price-cache');
      const portfolioCache = rawPortfolio ? JSON.parse(rawPortfolio) || {} : {};

      // Portfolio wins on conflict — its prices are driven by the 5-min
      // refresh loop and tend to be fresher.
      const merged: Record<string, unknown> = { ...watchlistCache, ...portfolioCache };

      localStorage.setItem('price-cache', JSON.stringify(merged));
      localStorage.removeItem('watchlist-price-cache');
    } catch {
      // Non-fatal
    }
  },

  /**
   * v3 → v4: Reconcile each holding's ledger with its stored shape.
   *
   * Why this is needed: migration 3's check for "does the holding need
   * a synthetic buy?" was too coarse — it only looked for the *existence*
   * of any buy in (ticker, portfolioId) scope. Holdings with closed-and-
   * reopened history have real legacy buys, so migration 3 skipped them,
   * but the chronological-reset deriveHolding from v1.4.2 then closes
   * those legacy cycles at zero shares. The current open position ends
   * up unrepresented.
   *
   * What this does: for each Holding, run deriveHolding to compute the
   * ledger view of (shares, avgBuyPrice). If derived shares ≠ stored
   * shares (within a small tolerance), append a synthetic top-up txn:
   *   - storedShares > derivedShares  →  synthetic BUY of the gap
   *   - storedShares < derivedShares  →  synthetic SELL of the gap
   *
   * The synthetic-buy price is chosen so the post-migration weighted-
   * average buy price exactly equals stored.buyPrice, preserving the
   * cost basis the user has been seeing for years. Synthetic sells are
   * stamped with costBasisPerShare=stored.buyPrice (no realized P&L
   * effect since they're synthetic reconciliations, not real trades).
   *
   * Synthetic txns are dated at holding.buyDate (or today as a fallback)
   * and tagged synthetic: true + holdingId: holding.id + an explanatory
   * note so the user knows why they exist if they ever scroll the
   * transaction log.
   *
   * Idempotent: re-running on already-reconciled data finds derived ==
   * stored for every holding and writes nothing.
   *
   * Cash holdings: skipped. Cash uses its own deposit/withdrawal/
   * interest/correction model which migration 3 already covers, and
   * the deriveHolding chronological-reset rule does not apply to cash.
   */
  4: () => {
    const DEFAULT_PORTFOLIO_ID = 'default';
    const SHARES_TOL = 1e-6;

    const makeId = (): string => {
      const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return `syn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    let holdings: Array<Record<string, unknown> & { id?: string }> = [];
    let txns: Transaction[] = [];

    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) holdings = parsed;
      }
    } catch {
      return; // malformed, leave alone
    }
    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {
      return; // malformed, leave alone
    }

    let added = 0;
    const newTxns: Transaction[] = [];

    for (const h of holdings) {
      if (!h || typeof h.id !== 'string' || typeof h.ticker !== 'string') continue;
      // Skip cash — different ledger model handled by migration 3.
      const assetType = typeof h.assetType === 'string' ? (h.assetType as AssetType) : 'stock';
      if (assetType === 'cash') continue;

      const storedShares = typeof h.shares === 'number' ? h.shares : 0;
      const storedBuyPrice = typeof h.buyPrice === 'number' ? h.buyPrice : 0;
      if (storedShares <= 0) continue;

      const portfolioId = typeof h.portfolioId === 'string' && h.portfolioId
        ? h.portfolioId
        : DEFAULT_PORTFOLIO_ID;
      const buyDate = typeof h.buyDate === 'string' && h.buyDate
        ? h.buyDate
        : new Date().toISOString().slice(0, 10);

      // Derive from the ledger using the chronological-reset algorithm.
      const d = deriveHolding(
        {
          id: h.id,
          ticker: h.ticker,
          portfolioId,
          assetType,
          buyDate,
        },
        // Include the synthetics we've already queued in this pass so
        // the next holding's derivation doesn't double-count them. (The
        // pass is per-holding, so this is mostly a safety net.)
        [...txns, ...newTxns],
      );

      const gap = storedShares - d.shares;
      if (Math.abs(gap) < SHARES_TOL) continue; // already agrees

      const ticker = h.ticker;
      const name = typeof h.name === 'string' ? h.name : ticker;
      const currency = typeof h.currency === 'string' ? h.currency : undefined;
      const buyFxRate = typeof h.buyFxRate === 'number' ? h.buyFxRate : undefined;
      const category = typeof h.category === 'string' ? h.category : undefined;

      if (gap > 0) {
        // Need a synthetic buy of `gap` shares. Choose its price so the
        // post-migration weighted-avg buy price equals storedBuyPrice:
        //
        //   weightedAvg = (existingBuyCost + gap * synPrice) / (existingBuyShares + gap)
        //   storedBuyPrice = ↑
        //
        // From deriveHolding's contract: when derived.shares > 0, the
        // weighted-avg of buys in the open cycle is d.buyPrice over
        // d.shares worth of buys. When derived.shares == 0 (post-reset),
        // there are no contributing buys in the open cycle.
        const existingBuyShares = d.shares; // positive contributors
        const existingBuyCost = existingBuyShares * d.buyPrice;
        const synPrice =
          existingBuyShares > 0
            ? (storedShares * storedBuyPrice - existingBuyCost) / gap
            : storedBuyPrice;

        const synthetic: Transaction = {
          id: makeId(),
          date: buyDate,
          ticker,
          name,
          type: 'buy',
          shares: gap,
          pricePerShare: synPrice,
          total: gap * synPrice,
          portfolioId,
          holdingId: h.id,
          synthetic: true,
          notes:
            'Phase 3 reconciliation (migration 4): brings the transaction ledger ' +
            'in line with the stored holding shares and cost basis. Auto-generated; ' +
            'safe to ignore or delete if you re-enter the actual purchase history.',
          assetType,
          ...(category ? { category } : {}),
          ...(currency ? { currency } : {}),
          ...(buyFxRate !== undefined ? { buyFxRate } : {}),
        };
        newTxns.push(synthetic);
        added++;
      } else {
        // gap < 0 — derived has more shares than stored. Add a synthetic
        // sell of |gap| shares at storedBuyPrice (so realized P&L is 0).
        const synShares = -gap;
        const synthetic: Transaction = {
          id: makeId(),
          date: buyDate,
          ticker,
          name,
          type: 'sell',
          shares: synShares,
          pricePerShare: storedBuyPrice,
          total: synShares * storedBuyPrice,
          costBasisPerShare: storedBuyPrice, // P&L impact: 0
          portfolioId,
          holdingId: h.id,
          synthetic: true,
          notes:
            'Phase 3 reconciliation (migration 4): brings the transaction ledger ' +
            'in line with the stored holding shares. Auto-generated.',
          assetType,
          ...(category ? { category } : {}),
          ...(currency ? { currency } : {}),
        };
        newTxns.push(synthetic);
        added++;
      }
    }

    if (added > 0) {
      try {
        localStorage.setItem('transactions', JSON.stringify([...txns, ...newTxns]));
      } catch {
        throw new Error('v4: failed to write reconciled transactions to localStorage');
      }
    }
  },

  /**
   * v4 → v5: Brute-force ledger reconciliation.
   *
   * Why: migration 4 dated synthetics at holding.buyDate. For closed-
   * and-reopened cycles, that date often sits BEFORE a closing sell, so
   * the chronological walk in deriveHolding partially consumes the
   * synthetic via the subsequent sell. Result: derived shares end up
   * short by exactly the absolute value of the historical net-sell
   * overhang. Migration 5 fixes this in a robust, repeatable way.
   *
   * Algorithm (per non-cash holding):
   *   1. Find every transaction tagged synthetic: true that is linked
   *      to this holding (by holdingId, or — for legacy synthetics —
   *      by ticker + portfolioId match). Remove them.
   *   2. With the cleaned ledger, run deriveHolding to compute the
   *      true open-cycle position.
   *   3. If derived === stored within tolerance, do nothing further.
   *   4. Otherwise, append ONE corrective synthetic txn:
   *        - Date = MAX(holding.buyDate, latest contributing txn date).
   *          This guarantees the synthetic is chronologically last so
   *          no prior sell can consume it.
   *        - storedShares > derivedShares  →  synthetic BUY of the gap,
   *          priced so weighted-avg = stored.buyPrice.
   *        - storedShares < derivedShares  →  synthetic SELL of the
   *          gap at stored.buyPrice (zero realized P&L impact).
   *
   * Idempotent: re-running on already-reconciled data wipes the
   * existing synthetic and re-adds an identical one. No drift.
   *
   * Cash holdings: skipped — different ledger model, handled by
   * migration 3 + the deriveHolding cash branch.
   */
  5: () => {
    const DEFAULT_PORTFOLIO_ID = 'default';
    const SHARES_TOL = 1e-6;

    const makeId = (): string => {
      const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return `syn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    let holdings: Array<Record<string, unknown> & { id?: string }> = [];
    let txns: Transaction[] = [];

    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) holdings = parsed;
      }
    } catch {
      return;
    }
    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {
      return;
    }

    let mutated = false;

    for (const h of holdings) {
      if (!h || typeof h.id !== 'string' || typeof h.ticker !== 'string') continue;
      const assetType = typeof h.assetType === 'string' ? (h.assetType as AssetType) : 'stock';
      if (assetType === 'cash') continue;

      const storedShares = typeof h.shares === 'number' ? h.shares : 0;
      const storedBuyPrice = typeof h.buyPrice === 'number' ? h.buyPrice : 0;
      if (storedShares <= 0) continue;

      const tickerUpper = h.ticker.toUpperCase();
      const portfolioId = typeof h.portfolioId === 'string' && h.portfolioId
        ? h.portfolioId
        : DEFAULT_PORTFOLIO_ID;
      const buyDate = typeof h.buyDate === 'string' && h.buyDate
        ? h.buyDate
        : new Date().toISOString().slice(0, 10);

      // Step 1: drop every prior synthetic linked to this holding.
      // Match by holdingId === h.id OR (synthetic && ticker + portfolioId match).
      const before = txns.length;
      txns = txns.filter((t) => {
        if (!t.synthetic) return true;
        if (t.holdingId === h.id) return false;
        if (
          !t.holdingId &&
          typeof t.ticker === 'string' &&
          t.ticker.toUpperCase() === tickerUpper &&
          t.portfolioId === portfolioId
        ) {
          return false;
        }
        return true;
      });
      if (txns.length !== before) mutated = true;

      // Step 2: derive from the cleaned ledger.
      const d = deriveHolding(
        { id: h.id, ticker: h.ticker, portfolioId, assetType, buyDate },
        txns,
      );
      const gap = storedShares - d.shares;
      if (Math.abs(gap) < SHARES_TOL) continue;

      // Step 3: pick a date that is chronologically last among
      // contributing txns (otherwise a later sell could consume the
      // synthetic). We approximate the contributing-txn pool the same
      // way deriveHolding does.
      let latestContribDate = '';
      for (const t of txns) {
        const matches = t.holdingId
          ? t.holdingId === h.id
          : typeof t.ticker === 'string' &&
            t.ticker.toUpperCase() === tickerUpper &&
            t.portfolioId === portfolioId &&
            (!buyDate || t.date >= buyDate);
        if (matches && typeof t.date === 'string' && t.date > latestContribDate) {
          latestContribDate = t.date;
        }
      }
      const synDate = latestContribDate > buyDate ? latestContribDate : buyDate;

      const ticker = h.ticker;
      const name = typeof h.name === 'string' ? h.name : ticker;
      const currency = typeof h.currency === 'string' ? h.currency : undefined;
      const buyFxRate = typeof h.buyFxRate === 'number' ? h.buyFxRate : undefined;
      const category = typeof h.category === 'string' ? h.category : undefined;

      if (gap > 0) {
        // Synthetic buy. Choose price so post-migration weighted-avg
        // equals storedBuyPrice. existingBuyShares/Cost come from the
        // open cycle that deriveHolding settled on.
        const existingBuyShares = d.shares;
        const existingBuyCost = existingBuyShares * d.buyPrice;
        const synPrice =
          existingBuyShares > 0
            ? (storedShares * storedBuyPrice - existingBuyCost) / gap
            : storedBuyPrice;

        txns.push({
          id: makeId(),
          date: synDate,
          ticker,
          name,
          type: 'buy',
          shares: gap,
          pricePerShare: synPrice,
          total: gap * synPrice,
          portfolioId,
          holdingId: h.id,
          synthetic: true,
          notes:
            'Phase 3 reconciliation (migration 5): one-time top-up to keep ' +
            'the transaction ledger in sync with stored holding shares + ' +
            'cost basis. Auto-generated; safe to delete or replace with ' +
            'real purchase history.',
          assetType,
          ...(category ? { category } : {}),
          ...(currency ? { currency } : {}),
          ...(buyFxRate !== undefined ? { buyFxRate } : {}),
        });
        mutated = true;
      } else {
        const synShares = -gap;
        txns.push({
          id: makeId(),
          date: synDate,
          ticker,
          name,
          type: 'sell',
          shares: synShares,
          pricePerShare: storedBuyPrice,
          total: synShares * storedBuyPrice,
          costBasisPerShare: storedBuyPrice,
          portfolioId,
          holdingId: h.id,
          synthetic: true,
          notes:
            'Phase 3 reconciliation (migration 5): one-time correction so ' +
            'the ledger matches stored holding shares. Auto-generated.',
          assetType,
          ...(category ? { category } : {}),
          ...(currency ? { currency } : {}),
        });
        mutated = true;
      }
    }

    if (mutated) {
      try {
        localStorage.setItem('transactions', JSON.stringify(txns));
      } catch {
        throw new Error('v5: failed to write reconciled transactions to localStorage');
      }
    }
  },

  /**
   * v5 → v6: Complete ledger reconcile (shares + buyPrice).
   *
   * Migration 5 only fixed shares mismatches. Holdings where shares
   * already agreed but buyPrice diverged (e.g. user's stored buyPrice
   * differs from the real-txn weighted-average) stayed divergent.
   * Migration 6 fixes both in one pass.
   *
   * Algorithm (per non-cash holding):
   *   1. Wipe every prior synthetic linked to this holding (both by
   *      holdingId and by ticker+portfolio fallback). Same as mig 5.
   *   2. Re-derive shares + buyPrice + totalBuyShares + totalBuyCost
   *      from the cleaned ledger.
   *   3. If derived.shares ≠ stored.shares (within tolerance):
   *      add ONE shares-fix synthetic (buy or sell of the gap, dated
   *      chronologically last). Same as mig 5.
   *   4. If derived.buyPrice ≠ stored.buyPrice (within tolerance):
   *      add a synthetic BUY + synthetic SELL pair, both dated
   *      chronologically last. The buy uses an off-market price chosen
   *      so the post-pair weighted-average exactly matches stored.buyPrice.
   *      The sell cancels the share change so the net position stays at
   *      stored.shares.
   *
   *      Math: post buys = totalBuyShares + X, post cost = totalBuyCost
   *      + X*P. Want (post cost / post shares) = stored.buyPrice. With
   *      X = totalBuyShares (or stored.shares if no buys exist), solve:
   *        P = stored.buyPrice + (stored.buyPrice − derived.buyPrice)
   *            * totalBuyShares / X
   *      Reduces to P = 2 * stored.buyPrice − derived.buyPrice when
   *      X = totalBuyShares.
   *
   * Reset-rule defense: the synthetic buy bumps shares from stored to
   * (stored + X), the synthetic sell brings it back to stored. As long
   * as stored > 0 (we already filter `storedShares <= 0` out), shares
   * never hit zero between the buy and sell, so the chronological-reset
   * doesn't fire.
   *
   * Idempotent: re-running wipes the synthetics again and re-adds the
   * same set. End state is identical.
   *
   * Cash holdings: skipped (different ledger model, handled by mig 3).
   */
  6: () => {
    const DEFAULT_PORTFOLIO_ID = 'default';
    const SHARES_TOL = 1e-6;
    const PRICE_TOL = 0.005; // half-cent — tighter than the validator's $0.01

    const makeId = (): string => {
      const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return `syn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    };

    let holdings: Array<Record<string, unknown> & { id?: string }> = [];
    let txns: Transaction[] = [];

    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) holdings = parsed;
      }
    } catch {
      return;
    }
    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {
      return;
    }

    let mutated = false;

    for (const h of holdings) {
      if (!h || typeof h.id !== 'string' || typeof h.ticker !== 'string') continue;
      const assetType = typeof h.assetType === 'string' ? (h.assetType as AssetType) : 'stock';
      if (assetType === 'cash') continue;

      const storedShares = typeof h.shares === 'number' ? h.shares : 0;
      const storedBuyPrice = typeof h.buyPrice === 'number' ? h.buyPrice : 0;
      if (storedShares <= 0) continue;

      const tickerUpper = h.ticker.toUpperCase();
      const portfolioId = typeof h.portfolioId === 'string' && h.portfolioId
        ? h.portfolioId
        : DEFAULT_PORTFOLIO_ID;
      const buyDate = typeof h.buyDate === 'string' && h.buyDate
        ? h.buyDate
        : new Date().toISOString().slice(0, 10);

      // Step 1: drop every prior synthetic linked to this holding.
      const before = txns.length;
      txns = txns.filter((t) => {
        if (!t.synthetic) return true;
        if (t.holdingId === h.id) return false;
        if (
          !t.holdingId &&
          typeof t.ticker === 'string' &&
          t.ticker.toUpperCase() === tickerUpper &&
          t.portfolioId === portfolioId
        ) {
          return false;
        }
        return true;
      });
      if (txns.length !== before) mutated = true;

      // Step 2: derive from cleaned ledger.
      const d = deriveHolding(
        { id: h.id, ticker: h.ticker, portfolioId, assetType, buyDate },
        txns,
      );

      // Find the chronologically-last contributing-txn date so we can
      // stamp synthetics after it.
      let latestContribDate = '';
      for (const t of txns) {
        const matches = t.holdingId
          ? t.holdingId === h.id
          : typeof t.ticker === 'string' &&
            t.ticker.toUpperCase() === tickerUpper &&
            t.portfolioId === portfolioId &&
            (!buyDate || t.date >= buyDate);
        if (matches && typeof t.date === 'string' && t.date > latestContribDate) {
          latestContribDate = t.date;
        }
      }
      const synDate = latestContribDate > buyDate ? latestContribDate : buyDate;

      const ticker = h.ticker;
      const name = typeof h.name === 'string' ? h.name : ticker;
      const currency = typeof h.currency === 'string' ? h.currency : undefined;
      const buyFxRate = typeof h.buyFxRate === 'number' ? h.buyFxRate : undefined;
      const category = typeof h.category === 'string' ? h.category : undefined;

      // Step 3: shares fix (if needed).
      const shareGap = storedShares - d.shares;
      let derivedSharesAfter = d.shares;
      let derivedTotalBuyShares = d.totalBuyShares;
      let derivedTotalBuyCost = d.totalBuyCost;

      if (Math.abs(shareGap) >= SHARES_TOL) {
        if (shareGap > 0) {
          // Synthetic buy. Price chosen so weighted-avg post-this-step
          // matches stored.buyPrice (assuming no further price-fix needed).
          const synPrice =
            d.totalBuyShares > 0
              ? (storedShares * storedBuyPrice - d.totalBuyCost) / shareGap
              : storedBuyPrice;
          txns.push({
            id: makeId(),
            date: synDate,
            ticker,
            name,
            type: 'buy',
            shares: shareGap,
            pricePerShare: synPrice,
            total: shareGap * synPrice,
            portfolioId,
            holdingId: h.id,
            synthetic: true,
            notes:
              'Phase 3 reconciliation (migration 6): one-time top-up to align ' +
              'transaction ledger with stored holding shares. Auto-generated; ' +
              'safe to delete or replace with real purchase history.',
            assetType,
            ...(category ? { category } : {}),
            ...(currency ? { currency } : {}),
            ...(buyFxRate !== undefined ? { buyFxRate } : {}),
          });
          derivedSharesAfter = storedShares;
          derivedTotalBuyShares += shareGap;
          derivedTotalBuyCost += shareGap * synPrice;
          mutated = true;
        } else {
          const synShares = -shareGap;
          txns.push({
            id: makeId(),
            date: synDate,
            ticker,
            name,
            type: 'sell',
            shares: synShares,
            pricePerShare: storedBuyPrice,
            total: synShares * storedBuyPrice,
            costBasisPerShare: storedBuyPrice,
            portfolioId,
            holdingId: h.id,
            synthetic: true,
            notes:
              'Phase 3 reconciliation (migration 6): one-time correction so ' +
              'the ledger matches stored holding shares. Auto-generated.',
            assetType,
            ...(category ? { category } : {}),
            ...(currency ? { currency } : {}),
          });
          derivedSharesAfter = storedShares;
          mutated = true;
        }
      }

      // Step 4: buyPrice fix (if needed). Recompute from updated locals.
      const currentBuyPrice =
        derivedTotalBuyShares > 0 ? derivedTotalBuyCost / derivedTotalBuyShares : 0;

      if (
        derivedSharesAfter > 0 &&
        Math.abs(currentBuyPrice - storedBuyPrice) > PRICE_TOL
      ) {
        // Add a synthetic buy + sell pair. Net 0 share change but adjusts
        // weighted-avg buyPrice.
        const X = derivedTotalBuyShares > 0 ? derivedTotalBuyShares : storedShares;
        // P solves: (totalBuyCost + X*P) / (totalBuyShares + X) = stored.buyPrice
        const synBuyPrice = (storedBuyPrice * (derivedTotalBuyShares + X) - derivedTotalBuyCost) / X;

        // Synthetic buy first.
        txns.push({
          id: makeId(),
          date: synDate,
          ticker,
          name,
          type: 'buy',
          shares: X,
          pricePerShare: synBuyPrice,
          total: X * synBuyPrice,
          portfolioId,
          holdingId: h.id,
          synthetic: true,
          notes:
            'Phase 3 reconciliation (migration 6): part 1 of 2 — adjusts the ' +
            'weighted-average cost basis to match stored holding.buyPrice. ' +
            'Paired with a synthetic sell of equal shares so the net position ' +
            'is unchanged.',
          assetType,
          ...(category ? { category } : {}),
          ...(currency ? { currency } : {}),
          ...(buyFxRate !== undefined ? { buyFxRate } : {}),
        });

        // Synthetic sell to cancel the share change. Date one day later
        // so the chronological sort ALWAYS places it after the buy
        // (date comparison is lexical and we want to be defensive against
        // unstable sorts even though localeCompare is stable).
        const synSellDate = bumpDateByOneDay(synDate);
        txns.push({
          id: makeId(),
          date: synSellDate,
          ticker,
          name,
          type: 'sell',
          shares: X,
          pricePerShare: storedBuyPrice,
          total: X * storedBuyPrice,
          costBasisPerShare: storedBuyPrice,
          portfolioId,
          holdingId: h.id,
          synthetic: true,
          notes:
            'Phase 3 reconciliation (migration 6): part 2 of 2 — cancels the ' +
            'share change from the paired synthetic buy. Net position unchanged.',
          assetType,
          ...(category ? { category } : {}),
          ...(currency ? { currency } : {}),
        });
        mutated = true;
      }
    }

    if (mutated) {
      try {
        localStorage.setItem('transactions', JSON.stringify(txns));
      } catch {
        throw new Error('v6: failed to write reconciled transactions to localStorage');
      }
    }
  },

  /**
   * v6 → v7: Phase 3 source-of-truth completion.
   *
   * Migrations 1-6 established and reconciled the ledger; the
   * useTxnSourceOfTruth flag now defaults to true. Migration 7 is the
   * final guardrail: walk every non-cash holding, derive its position
   * from the ledger, and if storage doesn't match (within tolerance),
   * write the derived values back so storage is a faithful cache of
   * the ledger from this point forward.
   *
   * Expected post-mig-6 state: NO holdings drift. Migration 7 should
   * be a complete no-op for users who ran migrations 1-6 successfully.
   * Only matters if storage drifted between mig 6 and now (manual edit,
   * partial update from a corrupt save, etc.) — in which case mig 7
   * silently corrects it on next boot.
   *
   * We deliberately do NOT strip shares/buyPrice/buyFxRate from the
   * Holding type or zero them out in storage. Too many consumers
   * (HoldingRow, AddTransactionModal, edit handlers, CSV import, etc.)
   * read those fields directly. Storage stays populated with derived
   * values; the ledger is the canonical source.
   *
   * Idempotent: writes only when there's drift.
   * Cash holdings: skipped (deriveHolding's cash branch is fed by
   * deposit/withdrawal/interest, which is its own model).
   */
  7: () => {
    const SHARES_TOL = 1e-6;
    const PRICE_TOL = 0.01; // matches the validator's tolerance

    let holdings: Array<Record<string, unknown> & { id?: string }> = [];
    let txns: Transaction[] = [];

    try {
      const raw = localStorage.getItem('portfolio-holdings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) holdings = parsed;
      }
    } catch {
      return;
    }
    try {
      const raw = localStorage.getItem('transactions');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) txns = parsed;
      }
    } catch {
      return;
    }

    let mutated = false;

    for (const h of holdings) {
      if (!h || typeof h.id !== 'string' || typeof h.ticker !== 'string') continue;
      const assetType = typeof h.assetType === 'string' ? (h.assetType as AssetType) : 'stock';
      if (assetType === 'cash') continue;

      const storedShares = typeof h.shares === 'number' ? h.shares : 0;
      const storedBuyPrice = typeof h.buyPrice === 'number' ? h.buyPrice : 0;
      if (storedShares <= 0) continue;

      const portfolioId = typeof h.portfolioId === 'string' && h.portfolioId
        ? h.portfolioId
        : 'default';
      const buyDate = typeof h.buyDate === 'string' && h.buyDate
        ? h.buyDate
        : undefined;

      const d = deriveHolding(
        { id: h.id, ticker: h.ticker, portfolioId, assetType, buyDate },
        txns,
      );

      if (d.matchedTxnCount === 0) continue; // no ledger to verify against

      const sharesDelta = Math.abs(d.shares - storedShares);
      const priceDelta = Math.abs(d.buyPrice - storedBuyPrice);

      if (sharesDelta > SHARES_TOL || priceDelta > PRICE_TOL) {
        // Storage drifted. Write derived values back.
        h.shares = d.shares;
        h.buyPrice = d.buyPrice;
        if (d.buyFxRate !== undefined) {
          h.buyFxRate = d.buyFxRate;
        }
        mutated = true;
      }
    }

    if (mutated) {
      try {
        localStorage.setItem('portfolio-holdings', JSON.stringify(holdings));
      } catch {
        throw new Error('v7: failed to write reconciled holdings to localStorage');
      }
    }
  },
};

/**
 * Adds one day to an ISO yyyy-mm-dd date string. Used by migration 6 to
 * place a synthetic sell strictly after a paired synthetic buy on the
 * chronological walk.
 */
function bumpDateByOneDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Maximum number of pre-migration backups to retain in localStorage.
 * Oldest are purged when this limit is exceeded.
 */
/**
 * Keep at least this many recent pre-migration backups. Sized to comfortably
 * exceed the current migration count so that running every pending
 * migration in a single boot still leaves the user with the rollback point
 * for the very first migration step. Bump if total migrations grow past 6.
 */
const MAX_BACKUPS_IN_LOCALSTORAGE = 8;

const BACKUP_KEY_PREFIX = '__pre_migration_';

/**
 * Writes a pre-migration backup to localStorage. Returns the key.
 * If localStorage is full, older backups are purged to make room.
 */
function writePreMigrationBackup(fromVersion: number, toVersion: number): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${BACKUP_KEY_PREFIX}${fromVersion}_to_${toVersion}_${timestamp}`;
  const payload = serializeBackup(gatherBackupData('pre-migration'));

  // Trim older backups to keep total count under the limit
  purgeOldBackups(MAX_BACKUPS_IN_LOCALSTORAGE - 1);

  try {
    localStorage.setItem(key, payload);
  } catch (err) {
    // Storage full. Try aggressively purging and retrying.
    purgeOldBackups(0);
    try {
      localStorage.setItem(key, payload);
    } catch {
      // If it still fails, throw — we do not proceed with migration if we
      // can't record a rollback point.
      throw new Error(
        `Failed to write pre-migration backup: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return key;
}

/**
 * Maximum age (days) for a pre-migration backup before it's pruned regardless
 * of count. Together with MAX_BACKUPS_IN_LOCALSTORAGE, this caps both the
 * count and the age of retained rollback points.
 */
const MAX_BACKUP_AGE_DAYS = 30;

function purgeOldBackups(keepCount: number): void {
  try {
    const now = Date.now();
    const ageCutoffMs = MAX_BACKUP_AGE_DAYS * 24 * 60 * 60 * 1000;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BACKUP_KEY_PREFIX)) keys.push(k);
    }
    // Sort oldest-first (timestamp is embedded so lexical sort works).
    keys.sort();

    // First pass — drop any backup older than MAX_BACKUP_AGE_DAYS.
    // The timestamp is the trailing component of the key after the last
    // underscore-prefixed colon-replaced ISO date. Parse it back.
    const ageDropped = new Set<string>();
    for (const k of keys) {
      // Key shape: __pre_migration_<from>_to_<to>_<timestamp>
      // After stripping prefix: <from>_to_<to>_<timestamp> (4 underscore-
      // separated parts). Drop the first three to get the timestamp.
      const tsPart = k.replace(`${BACKUP_KEY_PREFIX}`, '').split('_').slice(3).join('_');
      // tsPart looks like 2026-04-25T00-00-00-000Z (colons + dots replaced
      // with dashes during writePreMigrationBackup). Reverse it so Date can
      // parse: keep the date portion and put the time back together.
      const restored = tsPart.replace(
        /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
        '$1T$2:$3:$4.$5Z',
      );
      const ts = Date.parse(restored);
      if (!Number.isNaN(ts) && now - ts > ageCutoffMs) {
        try {
          localStorage.removeItem(k);
          ageDropped.add(k);
        } catch {
          /* best effort */
        }
      }
    }
    const remaining = keys.filter((k) => !ageDropped.has(k));

    // Second pass — apply the count cap on the remainder.
    const toRemove = remaining.slice(0, Math.max(0, remaining.length - keepCount));
    for (const k of toRemove) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* best effort */
      }
    }
  } catch {
    // best effort
  }
}

/**
 * Runs all pending migrations from the current stored version up to
 * CURRENT_SCHEMA_VERSION. Returns a summary of what ran.
 *
 * Behavior on failure:
 *   - The failing migration is recorded in history with `success: false`.
 *   - Subsequent migrations are NOT attempted.
 *   - The schemaVersion in app-meta is NOT advanced past the failed migration.
 *   - The caller is expected to surface this to the user (e.g. via the
 *     error boundary or a migration error screen) and offer rollback.
 */
export async function runMigrations(): Promise<{
  ran: MigrationRecord[];
  failed: MigrationRecord | null;
  finalVersion: number;
}> {
  const meta = readAppMeta();
  const ran: MigrationRecord[] = [];

  // First-run initialization: if the app-meta key doesn't exist yet, write it
  // with the current version. We assume any existing data on first boot of
  // this code is already compatible with CURRENT_SCHEMA_VERSION (since the
  // previous app had no schema versioning). Once the user has booted once,
  // future bumps will run migrations normally.
  if (!localStorage.getItem(APP_META_KEY)) {
    updateAppMeta({ schemaVersion: CURRENT_SCHEMA_VERSION });
    return { ran, failed: null, finalVersion: CURRENT_SCHEMA_VERSION };
  }

  let version = meta.schemaVersion;

  while (version < CURRENT_SCHEMA_VERSION) {
    const next = version + 1;
    const migration = MIGRATIONS[next];
    if (!migration) {
      // Gap in migrations — should not happen, but do not silently advance.
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: false,
        error: `No migration registered for target version ${next}`,
      };
      const m = readAppMeta();
      updateAppMeta({ history: [...m.history, record] });
      return { ran, failed: record, finalVersion: version };
    }

    let backupKey: string | undefined;
    try {
      backupKey = writePreMigrationBackup(version, next);
    } catch (err) {
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: false,
        error: `Pre-migration backup failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      const m = readAppMeta();
      updateAppMeta({ history: [...m.history, record] });
      return { ran, failed: record, finalVersion: version };
    }

    try {
      await migration();
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: true,
        backupKey,
      };
      const m = readAppMeta();
      updateAppMeta({
        schemaVersion: next,
        history: [...m.history, record],
      });
      ran.push(record);
      version = next;
    } catch (err) {
      const record: MigrationRecord = {
        toVersion: next,
        ranAt: new Date().toISOString(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        backupKey,
      };
      const m = readAppMeta();
      updateAppMeta({ history: [...m.history, record] });
      return { ran, failed: record, finalVersion: version };
    }
  }

  return { ran, failed: null, finalVersion: version };
}

/**
 * Lists all pre-migration backups currently in localStorage.
 * Surfaced by the error boundary and Settings for manual recovery.
 */
export function listPreMigrationBackups(): { key: string; sizeBytes: number }[] {
  const out: { key: string; sizeBytes: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(BACKUP_KEY_PREFIX)) {
        const v = localStorage.getItem(k) ?? '';
        out.push({ key: k, sizeBytes: v.length });
      }
    }
  } catch {
    // ignore
  }
  out.sort((a, b) => b.key.localeCompare(a.key)); // newest first
  return out;
}
