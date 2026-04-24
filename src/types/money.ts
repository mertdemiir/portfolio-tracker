/**
 * Money — a currency-tagged amount.
 *
 * The single biggest class of bugs in this app has been "is this number
 * in base currency, the holding's native currency, or USD?" These were
 * caught only through UI review + regression tests. `Money` makes the
 * currency part of the type: you can't pass a EUR amount into a USD
 * formatter without an explicit conversion, because the type requires
 * both.
 *
 * Rules:
 *   - Arithmetic only between same-currency values (addMoney, subMoney).
 *     Mixing currencies at compile time is a type error; at runtime we
 *     assert and throw with a clear message.
 *   - Conversion is explicit via convertMoney(money, toCurrency, rates).
 *   - Formatters accept Money and use its currency tag by default.
 *
 * This type is not yet used by the app — it's the foundation for a
 * follow-up pass that migrates EnrichedHolding's money-bearing fields
 * (marketValue, costBasis, gainLoss, dailyChange) from `number` to
 * `Money`. For now it's tested-but-unused.
 */

export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/** Create a Money value. Throws on NaN or Infinity. */
export function money(amount: number, currency: string): Money {
  if (!Number.isFinite(amount)) {
    throw new Error(`Money amount must be finite (got ${amount} ${currency})`);
  }
  return { amount, currency };
}

/** Zero in the given currency. */
export function zeroMoney(currency: string): Money {
  return { amount: 0, currency };
}

/** Returns true iff `a` and `b` have the same currency. */
export function sameCurrency(a: Money, b: Money): boolean {
  return a.currency === b.currency;
}

function requireSameCurrency(a: Money, b: Money, op: string): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot ${op} ${a.amount} ${a.currency} and ${b.amount} ${b.currency} — ` +
      `currencies differ. Convert one side first via convertMoney().`
    );
  }
}

export function addMoney(a: Money, b: Money): Money {
  requireSameCurrency(a, b, 'add');
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subMoney(a: Money, b: Money): Money {
  requireSameCurrency(a, b, 'subtract');
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function scaleMoney(a: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new Error(`Scale factor must be finite (got ${factor})`);
  }
  return { amount: a.amount * factor, currency: a.currency };
}

export function negateMoney(a: Money): Money {
  return { amount: -a.amount, currency: a.currency };
}

/** Sum a list of Money values. All must share one currency. */
export function sumMoney(values: Money[], currencyIfEmpty: string): Money {
  if (values.length === 0) return zeroMoney(currencyIfEmpty);
  const currency = values[0].currency;
  let total = 0;
  for (const v of values) {
    if (v.currency !== currency) {
      throw new Error(
        `sumMoney received mixed currencies: ${currency} and ${v.currency}. ` +
        `Convert to a single currency first.`
      );
    }
    total += v.amount;
  }
  return { amount: total, currency };
}

/**
 * Converts a Money value to the target currency using a converter fn.
 * The converter is expected to return the same amount when from === to.
 */
export function convertMoney(
  value: Money,
  toCurrency: string,
  convert: (amount: number, fromCurrency: string) => number,
): Money {
  if (value.currency === toCurrency) return value;
  return { amount: convert(value.amount, value.currency), currency: toCurrency };
}

/** True iff amount is 0 (ignores currency). */
export function isZeroMoney(m: Money): boolean {
  return m.amount === 0;
}

/** Returns -1, 0, or 1 comparing amounts. Asserts same currency. */
export function compareMoney(a: Money, b: Money): number {
  requireSameCurrency(a, b, 'compare');
  if (a.amount < b.amount) return -1;
  if (a.amount > b.amount) return 1;
  return 0;
}

/** Structurally equal (same currency + same amount). */
export function equalsMoney(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}
