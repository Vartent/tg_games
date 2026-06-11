import { describe, it, expect } from 'vitest';
import { serialize, deserialize, claimDailyStreak, buyRig, createInitialState } from '../src/engine';
import { EngineError } from '../src/types';
import { stateWithRigs } from './helpers';

describe('сериализация', () => {
  it('roundtrip сохраняет состояние целиком', () => {
    let s = stateWithRigs([
      { cell: 0, tier: 3, crew: 2, storage: 123.45 },
      { cell: 5, tier: 1 },
    ], {
      spills: [{ id: 1, cell: 0, taps: 2 }],
      workerPool: 3,
    });
    s = claimDailyStreak(s, 1000);
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('результат serialize — валидный JSON-стринг', () => {
    const s = buyRig(createInitialState(0), 0);
    expect(() => JSON.parse(serialize(s))).not.toThrow();
  });

  it('мусор на входе deserialize — EngineError(INVALID_SAVE)', () => {
    expect(() => deserialize('not a json')).toThrowError(new EngineError('INVALID_SAVE'));
    expect(() => deserialize('{"foo": 1}')).toThrowError(new EngineError('INVALID_SAVE'));
  });
});
