/** Доска: rows × cols, значение плитки 0..9 или null (лопнута, до досыпки). board[row][col].
 *  0 — зеро: зелёная клетка, к сумме не добавляет, лопнувший отрезок с ней — ×2 этому ходу + огонёк. */
export type Board = (number | null)[][];

export interface CellPos {
  r: number;
  c: number;
}

/** Свап двух соседних по стороне клеток. */
export interface Swap {
  a: CellPos;
  b: CellPos;
}

export interface Round {
  level: number;
  /** Зачётов для победы (1 зачёт = один лопнувший отрезок). */
  goal: number;
  seed: number;
  board: Board;
  /** Собрано зачётов (с учётом огонька). */
  score: number;
  startedAt: number;
  endsAt: number;
  extended: boolean;
  /** Множитель огонька (1 = потушен). */
  fireMult: number;
  /** Момент (ms), до которого горит огонёк; 0 = потушен. */
  fireUntil: number;
  /** Неуспешных свапов подряд (для эскалации штрафа). */
  failStreak: number;
  /** Момент последнего неуспешного свапа; 0 = не было. */
  lastFailAt: number;
}

/** Перемещение выжившей плитки при гравитации (для анимации падения). */
export interface TileMove {
  from: CellPos;
  to: CellPos;
}

/** Одна волна каскада: что лопнуло, сколько отрезков, как упало, что насыпалось, доска после. */
export interface Wave {
  popped: CellPos[];
  groups: number;
  moves: TileMove[];
  spawns: CellPos[];
  board: Board;
}

/** Итог хода для UI. waves === null — невалидный свап (штраф). */
export interface SwapOutcome {
  round: Round;
  /** Доска сразу после свапа, до каскадов (для анимации). */
  swapped: Board | null;
  waves: Wave[] | null;
  /** Зачётов за ход: лопнувших отрезков во всех волнах. */
  k: number;
  /** Множитель, применённый к этому ходу. */
  multiplier: number;
  /** Начислено зачётов: k * multiplier. */
  earned: number;
  /** В лопнувших клетках было зеро (×2 этому ходу + огонёк). */
  zero: boolean;
  /** После хода не осталось валидных свапов — поле перемешано заново. */
  reshuffled: boolean;
  /** Снято времени за неуспешный свап, мс (0 при валидном). */
  penaltyMs: number;
}

export class GameError extends Error {
  constructor(public code: GameErrorCode) {
    super(code);
    this.name = 'GameError';
  }
}

export type GameErrorCode = 'ROUND_OVER' | 'ROUND_ACTIVE' | 'ALREADY_EXTENDED';
