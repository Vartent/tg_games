/**
 * Логика игры (механика оригинала Fruit Box): рамка по полю, сумма цифр внутри ровно
 * RECT_TARGET — лопаются; пустоты остаются (рамку можно тянуть через них); поле истощается.
 * Уровни — растущая цель при фиксированном времени; доска дня — общий seed, score-attack.
 * Чистые функции, без мутаций входа. Никаких Date.now()/Math.random() — время (now, ms)
 * и seed приходят параметрами. Нарушения правил — throw new GameError(code).
 */
import type { Board, CellPos, Rect, RectOutcome, Round } from './types';
import { GameError } from './types';
import * as C from './constants';

// ===== PRNG =====

/** Детерминированный PRNG (mulberry32): seed -> () => [0,1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Номинал 1..9 равновероятно (как в оригинале). */
function randomDigit(rng: () => number): number {
  return C.MIN_TILE + Math.floor(rng() * (C.MAX_TILE - C.MIN_TILE + 1));
}

// ===== Параметры уровня =====

/** Лимит зеро на поле уровня: 0 до ZERO_START_LEVEL, дальше 1 + по одному каждые ZERO_STEP_LEVELS. */
export function maxZeros(level: number): number {
  if (level < C.ZERO_START_LEVEL) return 0;
  return 1 + Math.floor((level - C.ZERO_START_LEVEL) / C.ZERO_STEP_LEVELS);
}

/** Цель уровня в клетках. */
export function levelGoal(level: number): number {
  return Math.min(C.BASE_GOAL + (level - 1) * C.GOAL_STEP, C.MAX_GOAL);
}

// ===== Доска =====

const rows = (b: Board) => b.length;
const cols = (b: Board) => b[0]?.length ?? 0;

/** Зеро на доске сейчас. */
export function countZeros(board: Board): number {
  let n = 0;
  for (const row of board) for (const tile of row) if (tile === 0) n++;
  return n;
}

/** Сгенерировать поле ROWS×COLS от seed: цифры 1..9 равновероятно, зеро — не больше
 *  zeroCap; гарантируется хотя бы одна валидная рамка (иначе seed+1, ...). */
export function generateBoard(seed: number, zeroCap = 0): Board {
  for (let s = seed; ; s++) {
    const rng = createRng(s);
    let zeros = 0;
    const board: Board = Array.from({ length: C.ROWS }, () =>
      Array.from({ length: C.COLS }, () => {
        if (zeros < zeroCap && rng() < C.ZERO_SPAWN_CHANCE) {
          zeros++;
          return 0;
        }
        return randomDigit(rng);
      }),
    );
    if (hasAnyValidRect(board)) return board;
  }
}

/** Нормализованная рамка по двум углам. */
export function normRect(a: CellPos, b: CellPos): Rect {
  return {
    r1: Math.min(a.r, b.r),
    c1: Math.min(a.c, b.c),
    r2: Math.max(a.r, b.r),
    c2: Math.max(a.c, b.c),
  };
}

function rectInBounds(board: Board, rect: Rect): boolean {
  return rect.r1 >= 0 && rect.c1 >= 0 && rect.r2 < rows(board) && rect.c2 < cols(board);
}

/** Непустые клетки внутри рамки (зеро — тоже клетка). */
export function cellsInRect(board: Board, rect: Rect): CellPos[] {
  const out: CellPos[] = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      if (board[r]![c] !== null) out.push({ r, c });
    }
  }
  return out;
}

/** Сумма цифр внутри рамки (пустоты и зеро дают 0). */
export function rectSum(board: Board, rect: Rect): number {
  let sum = 0;
  for (let r = rect.r1; r <= rect.r2; r++) {
    for (let c = rect.c1; c <= rect.c2; c++) {
      sum += board[r]?.[c] ?? 0;
    }
  }
  return sum;
}

/** Валидна ли рамка: в границах и сумма ровно RECT_TARGET. */
export function isValidRect(board: Board, rect: Rect): boolean {
  return rectInBounds(board, rect) && rectSum(board, rect) === C.RECT_TARGET;
}

/** Есть ли на поле хотя бы одна валидная рамка. Через 2D-префиксные суммы — O(1) на рамку. */
export function hasAnyValidRect(board: Board): boolean {
  const R = rows(board);
  const Cn = cols(board);
  // P[r][c] — сумма прямоугольника (0,0)..(r-1,c-1)
  const P: number[][] = Array.from({ length: R + 1 }, () => Array(Cn + 1).fill(0));
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < Cn; c++) {
      P[r + 1]![c + 1] = (board[r]![c] ?? 0) + P[r]![c + 1]! + P[r + 1]![c]! - P[r]![c]!;
    }
  }
  const sum = (r1: number, c1: number, r2: number, c2: number) =>
    P[r2 + 1]![c2 + 1]! - P[r1]![c2 + 1]! - P[r2 + 1]![c1]! + P[r1]![c1]!;
  for (let r1 = 0; r1 < R; r1++) {
    for (let r2 = r1; r2 < R; r2++) {
      for (let c1 = 0; c1 < Cn; c1++) {
        for (let c2 = c1; c2 < Cn; c2++) {
          const s = sum(r1, c1, r2, c2);
          if (s === C.RECT_TARGET) return true;
          if (s > C.RECT_TARGET) break; // расширение вправо сумму не уменьшит
        }
      }
    }
  }
  return false;
}

/** Лопнуть клетки рамки: они становятся пустотами (без гравитации и досыпки). */
export function applyRect(board: Board, rect: Rect): { board: Board; popped: CellPos[] } {
  const popped = cellsInRect(board, rect);
  const next = board.map((row) => [...row]);
  for (const p of popped) next[p.r]![p.c] = null;
  return { board: next, popped };
}

// ===== Раунд =====

function makeRound(level: number, daily: boolean, goal: number, seed: number, board: Board, now: number): Round {
  return {
    level,
    daily,
    goal,
    seed,
    board,
    totalCells: rows(board) * cols(board),
    cleared: 0,
    score: 0,
    startedAt: now,
    endsAt: now + C.LEVEL_TIME_MS,
    extended: false,
    fireUntil: 0,
  };
}

/** Начать уровень: поле от seed, цель по уровню, 2 минуты. */
export function startLevel(level: number, seed: number, now: number): Round {
  return makeRound(level, false, levelGoal(level), seed, generateBoard(seed, maxZeros(level)), now);
}

/** Доска дня: общий для всех seed (дата), score-attack без цели, один зеро. */
export function startDaily(seed: number, now: number): Round {
  return makeRound(0, true, 0, seed, generateBoard(seed, C.DAILY_ZEROS), now);
}

export function isRoundActive(round: Round, now: number): boolean {
  return now < round.endsAt;
}

export function isWon(round: Round): boolean {
  return !round.daily && round.score >= round.goal;
}

/** Горит ли серия в момент now. */
export function isFireActive(round: Round, now: number): boolean {
  return now < round.fireUntil;
}

/** Доля очищенного поля. */
export function clearedRatio(round: Round): number {
  return round.cleared / round.totalCells;
}

/** Звёзды за раунд: 1 — цель взята, 2/3 — за долю очистки. Дейли и проигрыш — 0. */
export function starsFor(round: Round): number {
  if (!isWon(round)) return 0;
  const ratio = clearedRatio(round);
  return 1 + (ratio >= C.STAR2_RATIO ? 1 : 0) + (ratio >= C.STAR3_RATIO ? 1 : 0);
}

/**
 * Ход: рамка по углам a-b. Валидная (сумма ровно цели) -> клетки лопаются и остаются
 * пустотами; начисление = клетки × множитель. Серия: рамка не позже FIRE_WINDOW_MS после
 * предыдущей идёт ×FIRE_MULT; зеро в рамке даёт ×FIRE_MULT сразу. Любая валидная рамка
 * заводит/продлевает окно серии. Невалидная рамка — просто ничего (без штрафов).
 * over=true — на поле не осталось ходов. После endsAt — ROUND_OVER.
 */
export function playRect(round: Round, a: CellPos, b: CellPos, now: number): RectOutcome {
  if (!isRoundActive(round, now)) throw new GameError('ROUND_OVER');
  const rect = normRect(a, b);
  if (!isValidRect(round.board, rect)) {
    return { round, popped: [], multiplier: 1, earnedCells: 0, zero: false, over: false };
  }
  const { board, popped } = applyRect(round.board, rect);
  const zero = popped.some((p) => round.board[p.r]![p.c] === 0);
  const multiplier = zero || isFireActive(round, now) ? C.FIRE_MULT : 1;
  const earnedCells = popped.length * multiplier;
  return {
    round: {
      ...round,
      board,
      cleared: round.cleared + popped.length,
      score: round.score + earnedCells,
      fireUntil: now + C.FIRE_WINDOW_MS,
    },
    popped,
    multiplier,
    earnedCells,
    zero,
    over: !hasAnyValidRect(board),
  };
}

/** Выкуп продолжения после таймаута: ещё EXTENSION_MS от текущего момента, один раз за раунд.
 *  Оплата гемами — забота UI; движок отвечает только за время. */
export function continueRound(round: Round, now: number): Round {
  if (isRoundActive(round, now)) throw new GameError('ROUND_ACTIVE');
  if (round.extended) throw new GameError('ALREADY_EXTENDED');
  return { ...round, endsAt: now + C.EXTENSION_MS, extended: true };
}

/** Текст шер-карточки уровня. */
export function shareText(bestLevel: number): string {
  return `«${C.GAME_NAME}»: дошёл до уровня ${bestLevel}. Соберёшь больше?`;
}

/** Текст шер-карточки доски дня. */
export function shareDailyText(dateLabel: string, points: number, streak: number): string {
  return `«${C.GAME_NAME}» — доска дня ${dateLabel}: ${points} очков, стрик ${streak} 🔥 У всех одно поле — побьёшь?`;
}
