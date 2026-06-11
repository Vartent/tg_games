import { describe, it, expect } from 'vitest';
import { mergeRigs, storageCap } from '../src/engine';
import { EngineError } from '../src/types';
import { stateWithRigs } from './helpers';
import * as C from '../src/constants';

describe('merge вышек', () => {
  it('две T1 -> одна T2 в целевой ячейке, исходная пустеет', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }, { cell: 5, tier: 1 }]);
    const s1 = mergeRigs(s0, 0, 5);
    expect(s1.rigs).toHaveLength(1);
    const rig = s1.rigs[0]!;
    expect(rig.cell).toBe(5);
    expect(rig.tier).toBe(2);
  });

  it('merge можно делать из любых ячеек (соседство не требуется)', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 3 }, { cell: 11, tier: 3 }]);
    expect(mergeRigs(s0, 0, 11).rigs[0]!.tier).toBe(4);
  });

  it('экипажи складываются с капом по новому тиру', () => {
    const s0 = stateWithRigs([
      { cell: 0, tier: 1, crew: 1 },
      { cell: 1, tier: 1, crew: 1 },
    ]);
    expect(mergeRigs(s0, 0, 1).rigs[0]!.crew).toBe(2);

    const s2 = stateWithRigs([
      { cell: 0, tier: 4, crew: 4 },
      { cell: 1, tier: 4, crew: 4 },
    ]);
    // 4 + 4 = 8 > новый тир 5 -> кап 5
    expect(mergeRigs(s2, 0, 1).rigs[0]!.crew).toBe(5);
  });

  it('нефть складов складывается с капом по новому тиру', () => {
    const s0 = stateWithRigs([
      { cell: 0, tier: 1, storage: 3000 },
      { cell: 1, tier: 1, storage: 4000 },
    ]);
    expect(mergeRigs(s0, 0, 1).rigs[0]!.storage).toBeCloseTo(7000);

    const full = storageCap(1);
    const s2 = stateWithRigs([
      { cell: 0, tier: 1, storage: full },
      { cell: 1, tier: 1, storage: full },
    ]);
    // 2 капа T1 (14400) меньше капа T2 (15840) — влезает; проверяем кап на верхней границе
    const merged = mergeRigs(s2, 0, 1).rigs[0]!;
    expect(merged.storage).toBeLessThanOrEqual(storageCap(2));
  });

  it('разные тиры не мержатся', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }, { cell: 1, tier: 2 }]);
    expect(() => mergeRigs(s0, 0, 1)).toThrowError(new EngineError('TIER_MISMATCH'));
  });

  it('максимальный тир не мержится', () => {
    const s0 = stateWithRigs([
      { cell: 0, tier: C.MAX_TIER },
      { cell: 1, tier: C.MAX_TIER },
    ]);
    expect(() => mergeRigs(s0, 0, 1)).toThrowError(new EngineError('MAX_TIER_REACHED'));
  });

  it('нельзя мержить ячейку саму с собой', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }]);
    expect(() => mergeRigs(s0, 0, 0)).toThrowError(new EngineError('SAME_CELL'));
  });

  it('нельзя мержить из/в пустую ячейку', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }]);
    expect(() => mergeRigs(s0, 0, 1)).toThrowError(new EngineError('CELL_EMPTY'));
    expect(() => mergeRigs(s0, 1, 0)).toThrowError(new EngineError('CELL_EMPTY'));
  });
});
