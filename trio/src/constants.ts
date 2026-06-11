/** Правила «Трио» в числах. Матч-механика: свап двух соседних по стороне клеток;
 *  лопаются все горизонтальные/вертикальные отрезки с суммой ровно GROUP_TARGET,
 *  каскады без ограничений. Единый источник правды — docs/SPEC.md. */

export const MIN_TILE = 1;
export const MAX_TILE = 9;

/** Сумма лопающегося отрезка. Только 10 — вариантов нет. */
export const GROUP_TARGET = 10;

export const GAME_NAME = 'Трио';

/**
 * Сложность определяется размером поля (как в «Десятке»):
 * уровень 1 — поле BASE_COLS×(BASE_COLS+ROWS_OFFSET) и номиналы 1..BASE_MAX_TILE;
 * каждые LEVELS_PER_SIZE уровней +1 колонка, +1 ряд, +1 номинал до плато.
 */
export const BASE_COLS = 5;
export const MAX_COLS = 9;
export const ROWS_OFFSET = 3;
export const BASE_MAX_TILE = 5;
export const LEVELS_PER_SIZE = 2;

/** Веса номиналов: 1–5 равновероятны, старшие — тем реже, чем крупнее. */
export const TILE_WEIGHTS: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 0.55, 7: 0.4, 8: 0.3, 9: 0.2,
};

/** Цель уровня в зачётах; 1 зачёт = один лопнувший отрезок = GROUP_TARGET очков. */
export const BASE_GOAL = 10;
export const GOAL_STEP = 5;
export const MAX_GOAL = 50;

/** Время уровня: time(level) = max(BASE_TIME - (level-1)*TIME_STEP, MIN_TIME). */
export const BASE_TIME_MS = 90_000;
export const TIME_STEP_MS = 10_000;
export const MIN_TIME_MS = 60_000;

/** Огонёк: 2+ отрезков за один ход (вместе с каскадами) зажигают ×FIRE_MULT на FIRE_DURATION_MS
 *  и дают MULTI_TIME_BONUS_MS к таймеру. Пока горит — все ходы с множителем. Гаснет по времени. */
export const FIRE_MIN_K = 2;
export const FIRE_MULT = 2;
export const FIRE_DURATION_MS = 10_000;
export const MULTI_TIME_BONUS_MS = 10_000;

/** Зеро — зелёная клетка 0: к сумме отрезка не добавляет; лопнувший отрезок с зеро
 *  даёт ×FIRE_MULT этому же ходу и зажигает огонёк. Лимиты на поле — как в «Десятке». */
export const ZERO_START_LEVEL = 8;
export const ZERO_STEP_LEVELS = 12;
export const ZERO_SPAWN_CHANCE = 0.06;

/** Штраф за невалидный свап (ничего не лопается). Подряд (внутри окна) — эскалация: 1с, 2с, 3с... */
export const FAIL_PENALTY_MS = 1_000;
export const FAIL_SPAM_WINDOW_MS = 2_000;

/** Продолжение после таймаута: +30 сек, не больше одного за раунд. */
export const EXTENSION_MS = 30_000;

/** Гемы: стартовый подарок, цена продолжения, награда за rewarded-рекламу. */
export const GEMS_START = 30;
export const CONTINUE_COST_GEMS = 10;
export const GEMS_PER_REWARDED = 5;

/** Предохранитель каскадов: больше волн за один ход не разрешаем. */
export const CASCADE_CAP = 40;
