import { describe, it, expect } from 'vitest';
import {
  rigRate, storageCap, rigDepth, rigPrice, slotPrice,
  tankerCapacity, tankerUpgradePrice, createInitialState,
} from '../src/engine';
import * as C from '../src/constants';

describe('формулы добычи', () => {
  it('T1 с полным экипажем (1/1) качает BASE_RATE', () => {
    expect(rigRate(1, 1)).toBeCloseTo(C.BASE_RATE);
  });

  it('рост добычи ×2.2 за тир при полном экипаже', () => {
    expect(rigRate(2, 2)).toBeCloseTo(C.BASE_RATE * C.RATE_GROWTH);
    expect(rigRate(5, 5)).toBeCloseTo(C.BASE_RATE * C.RATE_GROWTH ** 4);
  });

  it('экипаж 0 даёт 50% добычи', () => {
    expect(rigRate(4, 0)).toBeCloseTo(C.BASE_RATE * C.RATE_GROWTH ** 3 * C.CREW_MIN_FACTOR);
  });

  it('экипаж половинный даёт 75% добычи', () => {
    expect(rigRate(4, 2)).toBeCloseTo(C.BASE_RATE * C.RATE_GROWTH ** 3 * 0.75);
  });
});

describe('склад и глубина', () => {
  it('кап склада = полная добыча тира за STORAGE_SECONDS', () => {
    expect(storageCap(1)).toBeCloseTo(C.BASE_RATE * C.STORAGE_SECONDS);
    expect(storageCap(3)).toBeCloseTo(C.BASE_RATE * C.RATE_GROWTH ** 2 * C.STORAGE_SECONDS);
  });

  it('глубина = DEPTH_FACTOR * tier^2', () => {
    expect(rigDepth(1)).toBe(40);
    expect(rigDepth(8)).toBe(2560);
    expect(rigDepth(12)).toBe(5760);
  });
});

describe('цены', () => {
  it('первая вышка стоит RIG_BASE_PRICE', () => {
    const s = createInitialState(0);
    expect(rigPrice(s)).toBeCloseTo(C.RIG_BASE_PRICE);
  });

  it('цена вышки растёт ×1.07 за каждую покупку', () => {
    const s = { ...createInitialState(0), rigsPurchased: 3 };
    expect(rigPrice(s)).toBeCloseTo(C.RIG_BASE_PRICE * C.RIG_PRICE_GROWTH ** 3);
  });

  it('цена слота растёт ×3 за каждый купленный', () => {
    const s0 = createInitialState(0);
    expect(slotPrice(s0)).toBeCloseTo(C.SLOT_BASE_PRICE);
    const s2 = { ...s0, slotsPurchased: 2 };
    expect(slotPrice(s2)).toBeCloseTo(C.SLOT_BASE_PRICE * 9);
  });

  it('ёмкость и цена апгрейда танкера', () => {
    expect(tankerCapacity(0)).toBeCloseTo(C.TANKER_BASE_CAPACITY);
    expect(tankerCapacity(2)).toBeCloseTo(C.TANKER_BASE_CAPACITY * C.TANKER_CAPACITY_GROWTH ** 2);
    expect(tankerUpgradePrice(0)).toBeCloseTo(C.TANKER_UPGRADE_BASE_PRICE);
    expect(tankerUpgradePrice(3)).toBeCloseTo(C.TANKER_UPGRADE_BASE_PRICE * C.TANKER_UPGRADE_PRICE_GROWTH ** 3);
  });
});
