import { describe, it, expect } from 'vitest';
import { tick, storageCap, rigRate } from '../src/engine';
import { stateWithRigs, fixedRng } from './helpers';

describe('tick: добыча', () => {
  it('вышка качает rate * dt в свой склад', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0 });
    const s1 = tick(s0, 10_000, fixedRng());
    expect(s1.rigs[0]!.storage).toBeCloseTo(rigRate(1, 1) * 10);
    expect(s1.lastTickAt).toBe(10_000);
  });

  it('неполный экипаж замедляет добычу', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 2, crew: 0 }], { lastTickAt: 0 });
    const s1 = tick(s0, 10_000, fixedRng());
    expect(s1.rigs[0]!.storage).toBeCloseTo(rigRate(2, 0) * 10);
  });

  it('добыча останавливается на капе склада и ставит fullSince', () => {
    const cap = storageCap(1);
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: cap - 1 }], { lastTickAt: 0 });
    const s1 = tick(s0, 100_000, fixedRng());
    expect(s1.rigs[0]!.storage).toBeCloseTo(cap);
    expect(s1.rigs[0]!.fullSince).not.toBeNull();
    // склад заполнился через ~1 сек после старта
    expect(s1.rigs[0]!.fullSince!).toBeLessThan(5_000);
  });

  it('fullSince сбрасывается, когда склад больше не полон', () => {
    const cap = storageCap(1);
    const s0 = stateWithRigs(
      [{ cell: 0, tier: 1, storage: cap / 2, fullSince: null }],
      { lastTickAt: 0 },
    );
    const s1 = tick(s0, 1_000, fixedRng());
    expect(s1.rigs[0]!.fullSince).toBeNull();
  });

  it('два tick подряд эквивалентны одному длинному', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 3 }], { lastTickAt: 0 });
    const oneShot = tick(s0, 60_000, fixedRng());
    const twoStep = tick(tick(s0, 30_000, fixedRng()), 60_000, fixedRng());
    expect(twoStep.rigs[0]!.storage).toBeCloseTo(oneShot.rigs[0]!.storage);
  });

  it('монеты от добычи не появляются (деньги — только через танкер)', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0 });
    const s1 = tick(s0, 60_000, fixedRng());
    expect(s1.coins).toBe(s0.coins);
  });
});

describe('tick: вертолёт', () => {
  it('прилёт вертолёта добавляет рабочих в пул и назначает следующий прилёт', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0, nextHeliAt: 5_000 });
    const s1 = tick(s0, 6_000, fixedRng());
    expect(s1.workerPool).toBe(2);
    expect(s1.nextHeliAt).toBe(5_000 + 3 * 3600_000);
  });

  it('пул рабочих не превышает WORKER_POOL_CAP', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], {
      lastTickAt: 0,
      nextHeliAt: 1_000,
      workerPool: 5,
    });
    const s1 = tick(s0, 2_000, fixedRng());
    expect(s1.workerPool).toBe(6);
  });

  it('за долгий период вертолёт прилетает несколько раз', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }], { lastTickAt: 0, nextHeliAt: 3600_000 });
    const s1 = tick(s0, 8 * 3600_000, fixedRng());
    // прилёты в 1ч, 4ч, 7ч -> 6 рабочих (кап 6)
    expect(s1.workerPool).toBe(6);
    expect(s1.nextHeliAt).toBeGreaterThan(8 * 3600_000);
  });
});
