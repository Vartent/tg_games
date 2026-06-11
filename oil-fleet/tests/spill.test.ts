import { describe, it, expect } from 'vitest';
import { tick, tapSpill, isSlowedBySpill, storageCap, rigRate } from '../src/engine';
import { EngineError } from '../src/types';
import { stateWithRigs, fixedRng } from './helpers';
import * as C from '../src/constants';

const cap1 = storageCap(1);

describe('появление разлива', () => {
  it('склад полон дольше SPILL_GRACE_MS -> пятно на ячейке вышки', () => {
    const s0 = stateWithRigs(
      [{ cell: 5, tier: 1, storage: cap1, fullSince: 0 }],
      { lastTickAt: 0 },
    );
    const s1 = tick(s0, C.SPILL_GRACE_MS + 1_000, fixedRng());
    expect(s1.spills).toHaveLength(1);
    expect(s1.spills[0]!.cell).toBe(5);
    expect(s1.spills[0]!.taps).toBe(0);
  });

  it('до истечения grace пятна нет', () => {
    const s0 = stateWithRigs(
      [{ cell: 5, tier: 1, storage: cap1, fullSince: 0 }],
      { lastTickAt: 0 },
    );
    const s1 = tick(s0, C.SPILL_GRACE_MS - 1_000, fixedRng());
    expect(s1.spills).toHaveLength(0);
  });

  it('на вышку — максимум одно активное пятно', () => {
    const s0 = stateWithRigs(
      [{ cell: 5, tier: 1, storage: cap1, fullSince: 0 }],
      { lastTickAt: 0 },
    );
    const s1 = tick(s0, C.SPILL_GRACE_MS + 1_000, fixedRng());
    const s2 = tick(s1, C.SPILL_GRACE_MS * 3, fixedRng());
    expect(s2.spills).toHaveLength(1);
  });
});

describe('эффект разлива', () => {
  // сетка 4x4: ячейка 5 соседствует с 1, 4, 6, 9
  const withSpill = (rigCell: number) =>
    stateWithRigs(
      [
        { cell: 5, tier: 1, storage: cap1, fullSince: 0 },
        { cell: rigCell, tier: 1 },
      ],
      { lastTickAt: 0, spills: [{ id: 1, cell: 5, taps: 0 }] },
    );

  it('сосед по 4-соседству замедлен', () => {
    expect(isSlowedBySpill(withSpill(4), 4)).toBe(true);
    expect(isSlowedBySpill(withSpill(1), 1)).toBe(true);
    expect(isSlowedBySpill(withSpill(6), 6)).toBe(true);
    expect(isSlowedBySpill(withSpill(9), 9)).toBe(true);
  });

  it('диагональ и дальние ячейки не замедлены', () => {
    expect(isSlowedBySpill(withSpill(0), 0)).toBe(false);
    expect(isSlowedBySpill(withSpill(10), 10)).toBe(false);
  });

  it('замедленный сосед качает вдвое меньше', () => {
    const s0 = withSpill(4);
    const s1 = tick(s0, 10_000, fixedRng());
    const neighbor = s1.rigs.find((r) => r.cell === 4)!;
    expect(neighbor.storage).toBeCloseTo(rigRate(1, 1) * 10 * C.SPILL_SLOW_FACTOR);
  });

  it('эффекты двух пятен не стакаются (всё равно ×0.5)', () => {
    const s0 = stateWithRigs(
      [{ cell: 5, tier: 1 }],
      {
        lastTickAt: 0,
        spills: [
          { id: 1, cell: 4, taps: 0 },
          { id: 2, cell: 6, taps: 0 },
        ],
      },
    );
    const s1 = tick(s0, 10_000, fixedRng());
    expect(s1.rigs[0]!.storage).toBeCloseTo(rigRate(1, 1) * 10 * C.SPILL_SLOW_FACTOR);
  });
});

describe('чистка разлива', () => {
  const dirty = () =>
    stateWithRigs([{ cell: 5, tier: 1 }], {
      spills: [{ id: 7, cell: 4, taps: 0 }],
    });

  it('тапы накапливаются, пятый тап удаляет пятно', () => {
    let s = dirty();
    for (let i = 1; i < C.SPILL_TAPS_TO_CLEAN; i++) {
      s = tapSpill(s, 7);
      expect(s.spills).toHaveLength(1);
      expect(s.spills[0]!.taps).toBe(i);
    }
    s = tapSpill(s, 7);
    expect(s.spills).toHaveLength(0);
  });

  it('после чистки сосед больше не замедлен', () => {
    let s = dirty();
    for (let i = 0; i < C.SPILL_TAPS_TO_CLEAN; i++) s = tapSpill(s, 7);
    expect(isSlowedBySpill(s, 5)).toBe(false);
  });

  it('тап по несуществующему пятну — ошибка', () => {
    expect(() => tapSpill(dirty(), 999)).toThrowError(new EngineError('SPILL_NOT_FOUND'));
  });
});
