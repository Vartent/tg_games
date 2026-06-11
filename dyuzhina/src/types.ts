/** Доска: ROWS × COLS, значение клетки 0..9 или null (лопнута — пустота остаётся).
 *  0 — зеро: зелёный джокер, к сумме рамки не добавляет, рамка с ним — ×2 + серия. */
export type Board = (number | null)[][];

export interface CellPos {
  r: number;
  c: number;
}

/** Нормализованная рамка: включительные углы, r1<=r2, c1<=c2. */
export interface Rect {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export interface Round {
  /** Номер уровня; 0 — доска дня. */
  level: number;
  daily: boolean;
  /** Цель в клетках (0 у доски дня — там score-attack). */
  goal: number;
  seed: number;
  board: Board;
  /** Клеток на поле в начале раунда. */
  totalCells: number;
  /** Лопнуто клеток за раунд (для процента очистки и звёзд). */
  cleared: number;
  /** Зачётные клетки с учётом огонька (очки = score × RECT_TARGET). */
  score: number;
  startedAt: number;
  endsAt: number;
  extended: boolean;
  /** Момент (ms), до которого живёт серия (огонёк); 0 = серия не начата. */
  fireUntil: number;
}

/** Итог рамки для UI. popped пуст — рамка невалидна (ничего не происходит). */
export interface RectOutcome {
  round: Round;
  popped: CellPos[];
  /** Множитель серии/зеро, применённый к этой рамке. */
  multiplier: number;
  /** Начислено зачётных клеток: popped.length × multiplier. */
  earnedCells: number;
  /** В рамке был зеро. */
  zero: boolean;
  /** После рамки на поле не осталось валидных ходов — раунд закончен досрочно. */
  over: boolean;
}

export class GameError extends Error {
  constructor(public code: GameErrorCode) {
    super(code);
    this.name = 'GameError';
  }
}

export type GameErrorCode = 'ROUND_OVER' | 'ROUND_ACTIVE' | 'ALREADY_EXTENDED';
