/**
 * Логика «Трио»: свап двух соседних клеток; лопаются все горизонтальные/вертикальные
 * отрезки с суммой ровно GROUP_TARGET; гравитация и каскады без ограничений;
 * уровни с растущим полем; огонёк за мульти-лопанье; зеро. Чистые функции, без мутаций входа.
 * Никаких Date.now()/Math.random() — время (now, ms) и rng приходят параметрами.
 * Нарушения правил — throw new GameError(code).
 */
import type { Board, CellPos, Swap, SwapOutcome, Round, TileMove, Wave } from './types';
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

/** Взвешенный номинал 1..maxTile: 1–5 равновероятны, старшие реже (TILE_WEIGHTS). */
function randomDigit(rng: () => number, maxTile: number): number {
  let total = 0;
  for (let d = C.MIN_TILE; d <= maxTile; d++) total += C.TILE_WEIGHTS[d] ?? 1;
  let roll = rng() * total;
  for (let d = C.MIN_TILE; d <= maxTile; d++) {
    roll -= C.TILE_WEIGHTS[d] ?? 1;
    if (roll < 0) return d;
  }
  return maxTile;
}

// ===== Параметры уровня (как в «Десятке») =====

/** Ступень размера: поле держит один размер LEVELS_PER_SIZE уровней. */
const sizeStep = (level: number) => Math.floor((level - 1) / C.LEVELS_PER_SIZE);

export function levelCols(level: number): number {
  return Math.min(C.BASE_COLS + sizeStep(level), C.MAX_COLS);
}

export function levelRows(level: number): number {
  return levelCols(level) + C.ROWS_OFFSET;
}

export function levelMaxTile(level: number): number {
  return Math.min(C.BASE_MAX_TILE + sizeStep(level), C.MAX_TILE);
}

/** Лимит зеро на поле: 0 до ZERO_START_LEVEL, дальше 1 + ещё по одному каждые ZERO_STEP_LEVELS. */
export function maxZeros(level: number): number {
  if (level < C.ZERO_START_LEVEL) return 0;
  return 1 + Math.floor((level - C.ZERO_START_LEVEL) / C.ZERO_STEP_LEVELS);
}

export function levelGoal(level: number): number {
  return Math.min(C.BASE_GOAL + (level - 1) * C.GOAL_STEP, C.MAX_GOAL);
}

export function levelTime(level: number): number {
  return Math.max(C.BASE_TIME_MS - (level - 1) * C.TIME_STEP_MS, C.MIN_TIME_MS);
}

// ===== Доска =====

const rows = (b: Board) => b.length;
const cols = (b: Board) => b[0]?.length ?? 0;

function inBounds(b: Board, p: CellPos): boolean {
  return p.r >= 0 && p.c >= 0 && p.r < rows(b) && p.c < cols(b);
}

/** Ключ клетки; stride 32 покрывает любые размеры поля. */
const key = (p: CellPos) => p.r * 32 + p.c;

/** Зеро на доске сейчас. */
export function countZeros(board: Board): number {
  let n = 0;
  for (const row of board) for (const tile of row) if (tile === 0) n++;
  return n;
}

/**
 * Все лопающиеся отрезки: горизонтальные и вертикальные, длина >= 2, без пустот,
 * сумма ровно GROUP_TARGET. Зеро сумму не меняет, поэтому после превышения цели
 * отрезок длиннее не смотрим (сумма не убывает).
 */
export function findGroups(board: Board): CellPos[][] {
  const out: CellPos[][] = [];
  const R = rows(board);
  const Cn = cols(board);

  const scan = (len: number, cellAt: (i: number) => CellPos) => {
    for (let i = 0; i < len - 1; i++) {
      let sum = 0;
      for (let j = i; j < len; j++) {
        const tile = board[cellAt(j).r]?.[cellAt(j).c] ?? null;
        if (tile === null) break;
        sum += tile;
        if (j > i && sum === C.GROUP_TARGET) {
          const cells: CellPos[] = [];
          for (let t = i; t <= j; t++) cells.push(cellAt(t));
          out.push(cells);
        }
        if (sum > C.GROUP_TARGET) break;
      }
    }
  };

  for (let r = 0; r < R; r++) scan(Cn, (c) => ({ r, c }));
  for (let c = 0; c < Cn; c++) scan(R, (r) => ({ r, c }));
  return out;
}

/** Гравитация + досыпка после лопанья (зеро — пока их меньше zeroCap).
 *  Проходимость не проверяет: каскады разрешаются в resolveCascades,
 *  отсутствие ходов лечится перемешиванием в playSwap. */
function collapseAndRefill(
  board: Board,
  popped: Set<number>,
  maxTile: number,
  rng: () => number,
  zeroCap: number,
): { board: Board; moves: TileMove[]; spawns: CellPos[] } {
  const R = rows(board);
  const Cn = cols(board);
  const next: Board = Array.from({ length: R }, () => Array(Cn).fill(null));
  const moves: TileMove[] = [];
  const spawns: CellPos[] = [];
  for (let c = 0; c < Cn; c++) {
    let writeR = R - 1;
    for (let r = R - 1; r >= 0; r--) {
      const tile = board[r]?.[c] ?? null;
      if (tile === null || popped.has(key({ r, c }))) continue;
      next[writeR]![c] = tile;
      if (writeR !== r) moves.push({ from: { r, c }, to: { r: writeR, c } });
      writeR--;
    }
    for (let r = writeR; r >= 0; r--) spawns.push({ r, c });
  }
  // Досыпка не должна сама замыкать десятки — иначе каскад не гаснет никогда
  // (комбинаций суммы 10 слишком много). Каскады создаёт только гравитация.
  let zeros = countZeros(next);
  for (const p of spawns) {
    if (zeros < zeroCap && rng() < C.ZERO_SPAWN_CHANCE && !completesGroup(next, p.r, p.c, 0)) {
      next[p.r]![p.c] = 0;
      zeros++;
      continue;
    }
    let v = randomDigit(rng, maxTile);
    for (let guard = 0; completesGroup(next, p.r, p.c, v) && guard < 20; guard++) {
      v = randomDigit(rng, maxTile);
    }
    next[p.r]![p.c] = v;
  }
  return { board: next, moves, spawns };
}

/** Разрешить каскады: лопать все отрезки, ронять, досыпать — пока поле не успокоится
 *  (или не сработает предохранитель CASCADE_CAP). */
export function resolveCascades(
  board: Board,
  maxTile: number,
  rng: () => number,
  zeroCap: number,
): { board: Board; waves: Wave[]; k: number; zero: boolean } {
  let cur = board;
  const waves: Wave[] = [];
  let k = 0;
  let zero = false;
  for (let i = 0; i < C.CASCADE_CAP; i++) {
    const groups = findGroups(cur);
    if (groups.length === 0) break;
    k += groups.length;
    const popped = new Set<number>();
    const cells: CellPos[] = [];
    for (const g of groups) {
      for (const p of g) {
        if (popped.has(key(p))) continue;
        popped.add(key(p));
        cells.push(p);
        if (cur[p.r]![p.c] === 0) zero = true;
      }
    }
    const res = collapseAndRefill(cur, popped, maxTile, rng, zeroCap);
    waves.push({ popped: cells, groups: groups.length, moves: res.moves, spawns: res.spawns, board: res.board });
    cur = res.board;
  }
  return { board: cur, waves, k, zero };
}

// ===== Свапы =====

export const isOrthAdjacent = (a: CellPos, b: CellPos) =>
  Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

/** Доска с обменянными клетками свапа (вход не мутируется). */
export function swapBoard(board: Board, swap: Swap): Board {
  const next = board.map((row) => [...row]);
  const va = next[swap.a.r]![swap.a.c]!;
  next[swap.a.r]![swap.a.c] = next[swap.b.r]![swap.b.c]!;
  next[swap.b.r]![swap.b.c] = va;
  return next;
}

/** Есть ли в линии отрезок (длина >= 2, без пустот) с суммой ровно GROUP_TARGET. */
function lineHasGroup(line: (number | null)[]): boolean {
  for (let i = 0; i < line.length - 1; i++) {
    let sum = 0;
    for (let j = i; j < line.length; j++) {
      const tile = line[j];
      if (tile === null || tile === undefined) break;
      sum += tile;
      if (j > i && sum === C.GROUP_TARGET) return true;
      if (sum > C.GROUP_TARGET) break;
    }
  }
  return false;
}

/** Появился ли отрезок в линиях, проходящих через затронутые свапом клетки. */
function swapCreatesGroup(after: Board, swap: Swap): boolean {
  const R = rows(after);
  for (const r of new Set([swap.a.r, swap.b.r])) {
    if (lineHasGroup(after[r]!)) return true;
  }
  for (const c of new Set([swap.a.c, swap.b.c])) {
    if (lineHasGroup(Array.from({ length: R }, (_, r) => after[r]![c] ?? null))) return true;
  }
  return false;
}

/** Валиден ли свап: соседние по стороне непустые клетки и после обмена что-то лопается. */
export function isValidSwap(board: Board, swap: Swap): boolean {
  if (!inBounds(board, swap.a) || !inBounds(board, swap.b)) return false;
  if (!isOrthAdjacent(swap.a, swap.b)) return false;
  if (board[swap.a.r]![swap.a.c] === null || board[swap.b.r]![swap.b.c] === null) return false;
  return swapCreatesGroup(swapBoard(board, swap), swap);
}

/** Есть ли на доске хотя бы один валидный свап. */
export function hasAnyValidSwap(board: Board): boolean {
  const R = rows(board);
  const Cn = cols(board);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < Cn; c++) {
      if (c + 1 < Cn && isValidSwap(board, { a: { r, c }, b: { r, c: c + 1 } })) return true;
      if (r + 1 < R && isValidSwap(board, { a: { r, c }, b: { r: r + 1, c } })) return true;
    }
  }
  return false;
}

// ===== Генерация =====

/** Замыкает ли номинал v в клетке (r,c) отрезок с суммой цели (в строке или колонке,
 *  по всем окнам, содержащим клетку; пустые клетки разрывают окно). Каждая группа
 *  содержит «последнюю поставленную» клетку, поэтому проверки при каждой постановке
 *  достаточно, чтобы постановки не создавали групп. */
function completesGroup(board: Board, r: number, c: number, v: number): boolean {
  const line = (len: number, at: (i: number) => number | null, pos: number): boolean => {
    let lo = pos;
    while (lo > 0 && at(lo - 1) !== null) lo--;
    for (let i = lo; i <= pos; i++) {
      let sum = 0;
      for (let j = i; j < len; j++) {
        const tile = j === pos ? v : at(j);
        if (tile === null) break;
        sum += tile;
        if (j > i && j >= pos && sum === C.GROUP_TARGET) return true;
        if (sum > C.GROUP_TARGET) break;
      }
    }
    return false;
  };
  return (
    line(cols(board), (i) => board[r]?.[i] ?? null, c) ||
    line(rows(board), (i) => board[i]?.[c] ?? null, r)
  );
}

/**
 * Сгенерировать доску уровня от seed: без готовых лопающихся отрезков,
 * с хотя бы одним валидным свапом, зеро — не больше maxZeros(level).
 * Конструктивно: каждый номинал подбирается так, чтобы не замкнуть отрезок
 * (зеро отрезок замкнуть не может — сумма не меняется). Если доска не подошла — seed+1.
 */
export function generateBoard(seed: number, level = 1): Board {
  const R = levelRows(level);
  const Cn = levelCols(level);
  const maxTile = levelMaxTile(level);
  const zeroCap = maxZeros(level);
  for (let s = seed; ; s++) {
    const rng = createRng(s);
    let zeros = 0;
    const board: Board = Array.from({ length: R }, () => Array(Cn).fill(null));
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < Cn; c++) {
        if (zeros < zeroCap && rng() < C.ZERO_SPAWN_CHANCE && !completesGroup(board, r, c, 0)) {
          board[r]![c] = 0;
          zeros++;
          continue;
        }
        let v = randomDigit(rng, maxTile);
        for (let guard = 0; completesGroup(board, r, c, v) && guard < 20; guard++) {
          v = randomDigit(rng, maxTile);
        }
        board[r]![c] = v;
      }
    }
    if (findGroups(board).length === 0 && hasAnyValidSwap(board)) return board;
  }
}

// ===== Раунд уровня =====

/** Начать уровень: поле, номиналы, цель и таймер — по уровню. */
export function startLevel(level: number, seed: number, now: number): Round {
  return {
    level,
    goal: levelGoal(level),
    seed,
    board: generateBoard(seed, level),
    score: 0,
    startedAt: now,
    endsAt: now + levelTime(level),
    extended: false,
    fireMult: 1,
    fireUntil: 0,
    failStreak: 0,
    lastFailAt: 0,
  };
}

export function isRoundActive(round: Round, now: number): boolean {
  return now < round.endsAt;
}

export function isWon(round: Round): boolean {
  return round.score >= round.goal;
}

/** Горит ли огонёк в момент now. */
export function isFireActive(round: Round, now: number): boolean {
  return now < round.fireUntil;
}

/**
 * Ход: свап двух соседних клеток.
 * Валидный (что-то лопается) -> каскады до упора; зачёты = лопнувшие отрезки всех волн.
 * Пока огонь горит, ход идёт с множителем FIRE_MULT; 2+ отрезков за ход зажигают/перезапускают
 * огонь и дают MULTI_TIME_BONUS_MS; зеро в лопнувшем — ×FIRE_MULT этому же ходу + огонёк.
 * Если после хода не осталось валидных свапов — поле перемешивается (reshuffled).
 * Невалидный свап -> штраф временем с эскалацией при спаме (как в «Десятке»).
 * После endsAt — ROUND_OVER.
 */
export function playSwap(round: Round, swap: Swap, now: number, rng: () => number): SwapOutcome {
  if (!isRoundActive(round, now)) throw new GameError('ROUND_OVER');
  if (!isValidSwap(round.board, swap)) {
    const spam = round.lastFailAt > 0 && now - round.lastFailAt < C.FAIL_SPAM_WINDOW_MS;
    const failStreak = spam ? round.failStreak + 1 : 1;
    const penaltyMs = C.FAIL_PENALTY_MS * failStreak;
    return {
      round: { ...round, endsAt: round.endsAt - penaltyMs, failStreak, lastFailAt: now },
      swapped: null,
      waves: null,
      k: 0,
      multiplier: 1,
      earned: 0,
      zero: false,
      reshuffled: false,
      penaltyMs,
    };
  }

  const swapped = swapBoard(round.board, swap);
  const res = resolveCascades(swapped, levelMaxTile(round.level), rng, maxZeros(round.level));

  let board = res.board;
  let reshuffled = false;
  if (!hasAnyValidSwap(board)) {
    board = generateBoard(Math.floor(rng() * 2 ** 31), round.level);
    reshuffled = true;
  }

  const multiplier = res.zero || isFireActive(round, now) ? C.FIRE_MULT : 1;
  const earned = res.k * multiplier;
  const ignites = res.k >= C.FIRE_MIN_K || res.zero;

  return {
    round: {
      ...round,
      board,
      score: round.score + earned,
      endsAt: round.endsAt + (res.k >= C.FIRE_MIN_K ? C.MULTI_TIME_BONUS_MS : 0),
      fireMult: ignites ? C.FIRE_MULT : round.fireMult,
      fireUntil: ignites ? now + C.FIRE_DURATION_MS : round.fireUntil,
      failStreak: 0,
      lastFailAt: 0,
    },
    swapped,
    waves: res.waves,
    k: res.k,
    multiplier,
    earned,
    zero: res.zero,
    reshuffled,
    penaltyMs: 0,
  };
}

/** Выкуп продолжения после таймаута: ещё EXTENSION_MS от текущего момента, один раз за раунд.
 *  Оплата гемами — забота UI; движок отвечает только за время. */
export function continueRound(round: Round, now: number): Round {
  if (isRoundActive(round, now)) throw new GameError('ROUND_ACTIVE');
  if (round.extended) throw new GameError('ALREADY_EXTENDED');
  return { ...round, endsAt: now + C.EXTENSION_MS, extended: true };
}

/** Текст шер-карточки. */
export function shareText(bestLevel: number): string {
  return `«${C.GAME_NAME}»: дошёл до уровня ${bestLevel}. Соберёшь больше?`;
}
