import { describe, it, expect } from 'vitest';
import {
  money,
  zeroMoney,
  addMoney,
  subMoney,
  scaleMoney,
  negateMoney,
  sumMoney,
  convertMoney,
  isZeroMoney,
  compareMoney,
  equalsMoney,
  sameCurrency,
} from '../money';

describe('money()', () => {
  it('constructs a Money value', () => {
    expect(money(100, 'USD')).toEqual({ amount: 100, currency: 'USD' });
  });

  it('throws on NaN', () => {
    expect(() => money(NaN, 'USD')).toThrow(/finite/);
  });

  it('throws on Infinity', () => {
    expect(() => money(Infinity, 'USD')).toThrow(/finite/);
  });
});

describe('zeroMoney', () => {
  it('returns 0 in the given currency', () => {
    expect(zeroMoney('EUR')).toEqual({ amount: 0, currency: 'EUR' });
  });
});

describe('add / sub', () => {
  it('adds amounts in the same currency', () => {
    expect(addMoney(money(10, 'USD'), money(5, 'USD'))).toEqual({
      amount: 15,
      currency: 'USD',
    });
  });

  it('subtracts amounts in the same currency', () => {
    expect(subMoney(money(10, 'USD'), money(3, 'USD'))).toEqual({
      amount: 7,
      currency: 'USD',
    });
  });

  it('throws clearly when currencies differ', () => {
    expect(() => addMoney(money(10, 'USD'), money(5, 'EUR'))).toThrow(
      /Cannot add.*USD.*EUR/
    );
  });

  it('suggests convertMoney in the error message', () => {
    expect(() => addMoney(money(10, 'USD'), money(5, 'EUR'))).toThrow(
      /convertMoney/
    );
  });
});

describe('scale / negate', () => {
  it('scales a Money value by a factor', () => {
    expect(scaleMoney(money(100, 'USD'), 0.5)).toEqual({
      amount: 50,
      currency: 'USD',
    });
  });

  it('negates', () => {
    expect(negateMoney(money(100, 'USD'))).toEqual({
      amount: -100,
      currency: 'USD',
    });
  });

  it('scale rejects NaN', () => {
    expect(() => scaleMoney(money(100, 'USD'), NaN)).toThrow(/finite/);
  });
});

describe('sumMoney', () => {
  it('sums a list in one currency', () => {
    expect(
      sumMoney(
        [money(10, 'USD'), money(20, 'USD'), money(30, 'USD')],
        'USD'
      )
    ).toEqual({ amount: 60, currency: 'USD' });
  });

  it('returns zero-in-fallback for empty lists', () => {
    expect(sumMoney([], 'EUR')).toEqual({ amount: 0, currency: 'EUR' });
  });

  it('throws on mixed currencies', () => {
    expect(() =>
      sumMoney([money(10, 'USD'), money(20, 'EUR')], 'USD')
    ).toThrow(/mixed currencies/);
  });
});

describe('convertMoney', () => {
  it('short-circuits when already in target currency', () => {
    const m = money(100, 'USD');
    expect(convertMoney(m, 'USD', () => { throw new Error('should not be called'); })).toBe(m);
  });

  it('invokes the converter for a cross-currency conversion', () => {
    const usdPerEur = 1.1;
    const converter = (amt: number, from: string) => {
      expect(from).toBe('EUR');
      return amt * usdPerEur;
    };
    const result = convertMoney(money(100, 'EUR'), 'USD', converter);
    expect(result.currency).toBe('USD');
    // Use toBeCloseTo to avoid floating-point comparison (100 * 1.1 has
    // a trailing ε in IEEE 754).
    expect(result.amount).toBeCloseTo(110, 6);
  });
});

describe('predicates + comparison', () => {
  it('isZeroMoney', () => {
    expect(isZeroMoney(money(0, 'USD'))).toBe(true);
    expect(isZeroMoney(money(0.01, 'USD'))).toBe(false);
  });

  it('sameCurrency', () => {
    expect(sameCurrency(money(10, 'USD'), money(20, 'USD'))).toBe(true);
    expect(sameCurrency(money(10, 'USD'), money(10, 'EUR'))).toBe(false);
  });

  it('compareMoney', () => {
    expect(compareMoney(money(10, 'USD'), money(20, 'USD'))).toBe(-1);
    expect(compareMoney(money(10, 'USD'), money(10, 'USD'))).toBe(0);
    expect(compareMoney(money(20, 'USD'), money(10, 'USD'))).toBe(1);
  });

  it('compareMoney throws on mixed currencies', () => {
    expect(() => compareMoney(money(10, 'USD'), money(10, 'EUR'))).toThrow();
  });

  it('equalsMoney requires both amount and currency to match', () => {
    expect(equalsMoney(money(10, 'USD'), money(10, 'USD'))).toBe(true);
    expect(equalsMoney(money(10, 'USD'), money(10, 'EUR'))).toBe(false);
    expect(equalsMoney(money(10, 'USD'), money(10.01, 'USD'))).toBe(false);
  });
});
