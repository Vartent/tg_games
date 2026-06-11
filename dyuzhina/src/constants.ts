/** Правила игры в числах. Механика оригинала (Fruit Box): рамка с суммой ровно
 *  RECT_TARGET, поле 10×17 без гравитации и досыпки — истощается за раунд.
 *  Единый источник правды — docs/SPEC.md. */

export const MIN_TILE = 1;
export const MAX_TILE = 9;

/** Целевая сумма рамки. Прод — 10 («Десятка»); A/B-вариант — сборка с VITE_CHAIN_TARGET=12 («Дюжина»). */
export const RECT_TARGET = Number(import.meta.env?.VITE_CHAIN_TARGET ?? 10);

/** Нейминг варианта. */
export const GAME_NAME = RECT_TARGET === 12 ? 'Дюжина' : 'Десятка';

/** Поле как в оригинале: 170 клеток, портретная ориентация — 10 колонок × 17 рядов. */
export const COLS = 10;
export const ROWS = 17;

/** Раунд — фиксированные 2 минуты (как в оригинале). Сложность растёт целью, не временем. */
export const LEVEL_TIME_MS = 120_000;

/** Цель уровня в клетках; игроку показываются очки = клетки × RECT_TARGET.
 *  Поле не пополняется, так что цель — это процент очистки: 40/170 ≈ 24%, 110/170 ≈ 65%. */
export const BASE_GOAL = 40;
export const GOAL_STEP = 8;
export const MAX_GOAL = 110;

/** Звёзды за долю очищенного поля (считаются только при выполненной цели).
 *  Полная очистка — отдельный «Perfect». */
export const STAR2_RATIO = 0.55;
export const STAR3_RATIO = 0.8;

/** Огонёк-серия: валидная рамка не позже FIRE_WINDOW_MS после предыдущей идёт ×FIRE_MULT
 *  и продлевает окно. Пауза дольше окна гасит серию. */
export const FIRE_WINDOW_MS = 6_000;
export const FIRE_MULT = 2;

/** Зеро — зелёная клетка 0 (джокер: сумму рамки не меняет, лопается вместе со всеми).
 *  Рамка с зеро идёт ×FIRE_MULT сразу и зажигает серию. Появляется при генерации поля:
 *  с ZERO_START_LEVEL по одному, +1 каждые ZERO_STEP_LEVELS; на доске дня — DAILY_ZEROS. */
export const ZERO_START_LEVEL = 8;
export const ZERO_STEP_LEVELS = 12;
export const ZERO_SPAWN_CHANCE = 0.06;
export const DAILY_ZEROS = 1;

/** Продолжение после таймаута: +30 сек, не больше одного за раунд (только в уровнях). */
export const EXTENSION_MS = 30_000;

/** Гемы: стартовый подарок, цена продолжения, награда за rewarded-рекламу. */
export const GEMS_START = 30;
export const CONTINUE_COST_GEMS = 10;
export const GEMS_PER_REWARDED = 5;
