/** Доска: rows × cols, значение плитки 1..9 или null (лопнута, до досыпки). board[row][col]. */
export type Board = (number | null)[][];

export interface CellPos {
  r: number;
  c: number;
}

/** Змейка: упорядоченная цепочка клеток. */
export type Path = CellPos[];

export interface Round {
  level: number;
  /** Дюжин для победы. */
  goal: number;
  seed: number;
  board: Board;
  /** Собрано дюжин (с учётом огонька). */
  score: number;
  startedAt: number;
  endsAt: number;
  extended: boolean;
  /** Множитель огонька (1 = потушен). */
  fireMult: number;
  /** Момент (ms), до которого горит огонёк; 0 = потушен. */
  fireUntil: number;
  /** Неуспешных попыток подряд (для эскалации штрафа). */
  failStreak: number;
  /** Момент последней неуспешной попытки; 0 = не было. */
  lastFailAt: number;
}

/** Перемещение выжившей плитки при гравитации (для анимации падения). */
export interface TileMove {
  from: CellPos;
  to: CellPos;
}

/** Результат применения цепочки: новая доска + данные для анимации. */
export interface PathResult {
  board: Board;
  cleared: number;
  moves: TileMove[];
  spawns: CellPos[];
}

/** Итог хода для UI: сколько дюжин в цепи, множитель огонька, начислено. */
export interface PlayOutcome {
  round: Round;
  result: PathResult | null;
  /** Дюжин в цепочке (sum / 12). */
  k: number;
  /** Множитель огонька, применённый к этому ходу. */
  multiplier: number;
  /** Начислено дюжин: k * multiplier. */
  earned: number;
  /** Снято времени за неуспешную попытку, мс (0 при валидной цепи). */
  penaltyMs: number;
}

export class GameError extends Error {
  constructor(public code: GameErrorCode) {
    super(code);
    this.name = 'GameError';
  }
}

export type GameErrorCode = 'ROUND_OVER' | 'ROUND_ACTIVE' | 'ALREADY_EXTENDED';
