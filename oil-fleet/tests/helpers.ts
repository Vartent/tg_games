import { createInitialState } from '../src/engine';
import type { GameState, Rig } from '../src/types';

/** rng-заглушка: всегда возвращает одно значение. */
export const fixedRng = (v = 0) => () => v;

let nextId = 1000;

/** Состояние с произвольно расставленными вышками (для тестов merge/production/spill). */
export function stateWithRigs(
  rigs: Array<Partial<Rig> & { cell: number; tier: number }>,
  overrides: Partial<GameState> = {},
): GameState {
  const base = createInitialState(0);
  return {
    ...base,
    coins: 1_000_000,
    rigs: rigs.map((r) => ({
      id: nextId++,
      crew: r.tier,
      storage: 0,
      fullSince: null,
      ...r,
    })),
    ...overrides,
  };
}
