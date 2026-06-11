/**
 * Логика игры: змейка с суммой, кратной цели (CHAIN_TARGET: 10 — «Десятка», 12 — «Дюжина»);
 * гравитация; уровни с растущим полем; огонёк за двойные цепочки. Чистые функции, без мутаций входа.
 * Никаких Date.now()/Math.random() — время (now, ms) и rng приходят параметрами.
 * Нарушения правил — throw new GameError(code).
 */
import type { Board, CellPos, Path, PathResult, PlayOutcome, Round, TileMove } from './types';
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

// ===== Параметры уровня =====

/** Ступень размера: поле держит один размер LEVELS_PER_SIZE уровней. */
const sizeStep = (level: number) => Math.floor((level - 1) / C.LEVELS_PER_SIZE);

/** Колонок на уровне: 5 -> 9, +1 за ступень размера. */
export function levelCols(level: number): number {
  return Math.min(C.BASE_COLS + sizeStep(level), C.MAX_COLS);
}

/** Рядов на уровне: колонки + ROWS_OFFSET (портретная пропорция). */
export function levelRows(level: number): number {
  return levelCols(level) + C.ROWS_OFFSET;
}

/** Максимальный номинал на уровне: 5 -> 9, новый номинал с каждым расширением поля. */
export function levelMaxTile(level: number): number {
  return Math.min(C.BASE_MAX_TILE + sizeStep(level), C.MAX_TILE);
}

/** Лимит зеро на поле: 0 до ZERO_START_LEVEL, дальше 1 + ещё по одному каждые ZERO_STEP_LEVELS. */
export function maxZeros(level: number): number {
  if (level < C.ZERO_START_LEVEL) return 0;
  return 1 + Math.floor((level - C.ZERO_START_LEVEL) / C.ZERO_STEP_LEVELS);
}

/** Цель уровня в зачётах (десятках/дюжинах). */
export function levelGoal(level: number): number {
  return Math.min(C.BASE_GOAL + (level - 1) * C.GOAL_STEP, C.MAX_GOAL);
}

/** Время уровня, мс. */
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
 * Сгенерировать доску уровня от seed: размер и номиналы — по уровню,
 * зеро — не больше maxZeros(level), гарантируется хотя бы одна валидная цепочка (иначе seed+1, ...).
 */
export function generateBoard(seed: number, level = 1): Board {
  const r = levelRows(level);
  const c = levelCols(level);
  const maxTile = levelMaxTile(level);
  const zeroCap = maxZeros(level);
  for (let s = seed; ; s++) {
    const rng = createRng(s);
    let zeros = 0;
    const board: Board = Array.from({ length: r }, () =>
      Array.from({ length: c }, () => {
        if (zeros < zeroCap && rng() < C.ZERO_SPAWN_CHANCE) {
          zeros++;
          return 0;
        }
        return randomDigit(rng, maxTile);
      }),
    );
    if (hasAnyUnitPath(board)) return board;
  }
}

/** Сумма цифр цепочки (пустые клетки за 0). */
export function pathSum(board: Board, path: Path): number {
  let sum = 0;
  for (const p of path) sum += (inBounds(board, p) ? board[p.r]![p.c] : 0) ?? 0;
  return sum;
}

/** Зачётов в цепочке: sum/CHAIN_TARGET при сумме ровно ×1 или ×2 от цели, иначе 0. */
export function unitsIn(sum: number): number {
  if (sum <= 0 || sum % C.CHAIN_TARGET !== 0) return 0;
  const k = sum / C.CHAIN_TARGET;
  return k <= C.MAX_CHAIN_UNITS ? k : 0;
}

const isAdjacent = (a: CellPos, b: CellPos) =>
  Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1 && !(a.r === b.r && a.c === b.c);

/** Валидна ли змейка: уникальные непустые клетки, каждая — сосед предыдущей,
 *  сумма ровно CHAIN_TARGET или 2×CHAIN_TARGET (один-два зачёта с цепи). */
export function isValidPath(board: Board, path: Path): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    if (!inBounds(board, p)) return false;
    if (board[p.r]![p.c] === null) return false;
    if (seen.has(key(p))) return false;
    seen.add(key(p));
    if (i > 0 && !isAdjacent(path[i - 1]!, p)) return false;
  }
  return unitsIn(pathSum(board, path)) > 0;
}

/**
 * Есть ли на доске хотя бы одна валидная цепочка (сумма ×1/×2 от цели).
 * DFS с отсечением. При исчерпании бюджета узлов — false: на живых досках цепочка находится
 * за первые сотни узлов, а бюджет выедают как раз вырожденные доски без цепочек; ложный
 * отрицательный ответ безопасен (генерация возьмёт следующий seed, досыпка положит связку).
 */
export function hasAnyUnitPath(board: Board): boolean {
  let nodes = 0;
  const visited = new Set<number>();

  const dfs = (p: CellPos, sum: number): boolean => {
    if (++nodes > C.PATH_SEARCH_BUDGET) throw nodes;
    if (unitsIn(sum) > 0) return true;
    if (sum >= C.CHAIN_SUM_CAP) return false;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const next = { r: p.r + dr, c: p.c + dc };
        if (!inBounds(board, next)) continue;
        const tile = board[next.r]![next.c];
        if (tile == null || visited.has(key(next))) continue;
        visited.add(key(next));
        if (dfs(next, sum + tile)) return true;
        visited.delete(key(next));
      }
    }
    return false;
  };

  try {
    for (let r = 0; r < rows(board); r++) {
      for (let c = 0; c < cols(board); c++) {
        const tile = board[r]![c];
        if (tile == null) continue;
        visited.clear();
        visited.add(key({ r, c }));
        if (dfs({ r, c }, tile)) return true;
      }
    }
    return false;
  } catch {
    return false; // бюджет исчерпан
  }
}

// ===== Гравитация и досыпка =====

/** Принудительная связка на один зачёт из максимальных номиналов,
 *  выкладывается бустрофедоном от (0,0): 5+5 (цель 10), 9+3 (цель 12) и т.п. */
function placeForcedRun(board: Board, maxTile: number): void {
  const run: number[] = [];
  let rest = C.CHAIN_TARGET;
  while (rest > maxTile) {
    run.push(maxTile);
    rest -= maxTile;
  }
  run.push(rest);
  run.forEach((digit, i) => {
    const r = Math.floor(i / cols(board));
    const cRaw = i % cols(board);
    const c = r % 2 === 0 ? cRaw : cols(board) - 1 - cRaw;
    board[r]![c] = digit;
  });
}

/**
 * Лопнуть клетки цепочки, схлопнуть колонки вниз, досыпать новые цифры сверху (номиналы <= maxTile,
 * зеро — пока на доске их меньше zeroCap). Кратность суммы не проверяет (валидация — в playPath).
 * Гарантирует проходимость результата: до REFILL_ATTEMPTS перегенераций досыпки, затем принудительная связка.
 */
export function applyPath(
  board: Board,
  path: Path,
  maxTile: number,
  rng: () => number,
  zeroCap = 0,
): PathResult {
  const popped = new Set<number>(path.map(key));
  let cleared = 0;
  for (const p of path) {
    if (inBounds(board, p) && board[p.r]![p.c] !== null) cleared++;
  }

  const R = rows(board);
  const Cn = cols(board);
  const next: Board = Array.from({ length: R }, () => Array(Cn).fill(null));
  const moves: TileMove[] = [];
  const spawnCells: CellPos[] = [];
  for (let c = 0; c < Cn; c++) {
    let writeR = R - 1;
    for (let r = R - 1; r >= 0; r--) {
      const tile = board[r]![c];
      if (tile == null || popped.has(key({ r, c }))) continue;
      next[writeR]![c] = tile;
      if (writeR !== r) moves.push({ from: { r, c }, to: { r: writeR, c } });
      writeR--;
    }
    for (let r = writeR; r >= 0; r--) spawnCells.push({ r, c });
  }

  const baseZeros = countZeros(next); // выжившие зеро занимают лимит
  const fill = () => {
    let zeros = baseZeros;
    for (const p of spawnCells) {
      if (zeros < zeroCap && rng() < C.ZERO_SPAWN_CHANCE) {
        next[p.r]![p.c] = 0;
        zeros++;
      } else {
        next[p.r]![p.c] = randomDigit(rng, maxTile);
      }
    }
  };
  fill();
  let attempts = 0;
  while (!hasAnyUnitPath(next) && attempts < C.REFILL_ATTEMPTS) {
    fill();
    attempts++;
  }
  if (!hasAnyUnitPath(next)) placeForcedRun(next, maxTile);

  return { board: next, cleared, moves, spawns: spawnCells };
}

// ===== Раунд уровня =====

/** Начать уровень: поле, номиналы, цель (в дюжинах) и таймер — по уровню. */
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
 * Цепочка в раунде: валидная (ровно ×1/×2 от цели) -> гравитация, начисление дюжин с огоньком:
 * пока огонь горит, ЛЮБАЯ цепочка идёт с множителем FIRE_MULT. Цепь на две дюжины
 * зажигает/перезапускает огонь и даёт CHAIN_TIME_BONUS_MS к таймеру; одиночная дюжина
 * огонь не трогает — он гаснет только по времени.
 * Зеро в цепочке: множитель FIRE_MULT применяется к ЭТОЙ же цепи и огонь зажигается/перезапускается.
 * Невалидная -> штраф временем: FAIL_PENALTY_MS, при спаме (следующая неудача раньше
 * FAIL_SPAM_WINDOW_MS) — эскалация ×2, ×3... Валидная цепь сбрасывает эскалацию.
 * После endsAt — ROUND_OVER.
 */
export function playPath(round: Round, path: Path, now: number, rng: () => number): PlayOutcome {
  if (!isRoundActive(round, now)) throw new GameError('ROUND_OVER');
  if (!isValidPath(round.board, path)) {
    const spam = round.lastFailAt > 0 && now - round.lastFailAt < C.FAIL_SPAM_WINDOW_MS;
    const failStreak = spam ? round.failStreak + 1 : 1;
    const penaltyMs = C.FAIL_PENALTY_MS * failStreak;
    return {
      round: { ...round, endsAt: round.endsAt - penaltyMs, failStreak, lastFailAt: now },
      result: null,
      k: 0,
      multiplier: 1,
      earned: 0,
      zero: false,
      penaltyMs,
    };
  }
  const k = unitsIn(pathSum(round.board, path));
  const zero = path.some((p) => round.board[p.r]?.[p.c] === 0);
  const result = applyPath(round.board, path, levelMaxTile(round.level), rng, maxZeros(round.level));

  const multiplier = zero || isFireActive(round, now) ? C.FIRE_MULT : 1;
  const earned = k * multiplier;
  const ignites = k >= C.FIRE_MIN_K || zero;

  return {
    round: {
      ...round,
      board: result.board,
      score: round.score + earned,
      endsAt: round.endsAt + (k >= C.FIRE_MIN_K ? C.CHAIN_TIME_BONUS_MS : 0),
      fireMult: ignites ? C.FIRE_MULT : round.fireMult,
      fireUntil: ignites ? now + C.FIRE_DURATION_MS : round.fireUntil,
      failStreak: 0,
      lastFailAt: 0,
    },
    result,
    k,
    multiplier,
    earned,
    zero,
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
