import type { Board, Round } from '../src/types';
import { levelGoal } from '../src/game';

/** Доска из строк цифр как есть (без дополнения); '.' = пустая. */
export function board(rowsSpec: string[]): Board {
  return rowsSpec.map((row) => row.split('').map((ch) => (ch === '.' ? null : Number(ch))));
}

/** Раунд с подкрученной доской — для проверки ходов, серии и звёзд. */
export function makeRound(rowsSpec: string[], overrides: Partial<Round> = {}): Round {
  const b = board(rowsSpec);
  return {
    level: 1,
    daily: false,
    goal: levelGoal(1),
    seed: 1,
    board: b,
    totalCells: b.length * (b[0]?.length ?? 0),
    cleared: 0,
    score: 0,
    startedAt: 0,
    endsAt: 120_000,
    extended: false,
    fireUntil: 0,
    ...overrides,
  };
}
