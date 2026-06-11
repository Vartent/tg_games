import { describe, it, expect } from 'vitest';
import { assignWorker, rigRate } from '../src/engine';
import { EngineError } from '../src/types';
import { stateWithRigs } from './helpers';

describe('назначение рабочих', () => {
  it('рабочий из пула уходит на вышку', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 3, crew: 1 }], { workerPool: 2 });
    const s1 = assignWorker(s0, 0);
    expect(s1.rigs[0]!.crew).toBe(2);
    expect(s1.workerPool).toBe(1);
  });

  it('добыча растёт с экипажем', () => {
    expect(rigRate(3, 3)).toBeGreaterThan(rigRate(3, 1));
  });

  it('нельзя назначить при пустом пуле', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 3, crew: 1 }], { workerPool: 0 });
    expect(() => assignWorker(s0, 0)).toThrowError(new EngineError('NO_WORKERS_IN_POOL'));
  });

  it('нельзя назначить сверх лимита tier', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 2, crew: 2 }], { workerPool: 3 });
    expect(() => assignWorker(s0, 0)).toThrowError(new EngineError('CREW_FULL'));
  });

  it('нельзя назначить на пустую ячейку', () => {
    const s0 = stateWithRigs([], { workerPool: 3 });
    expect(() => assignWorker(s0, 4)).toThrowError(new EngineError('CELL_EMPTY'));
  });
});
