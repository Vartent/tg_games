/** Правила игры в числах. Единый источник правды — docs/SPEC.md. */

export const MIN_TILE = 1;
export const MAX_TILE = 9;

/** Целевая сумма цепочки. Прод — 10 («Десятка»); A/B-вариант — сборка с VITE_CHAIN_TARGET=12 («Дюжина»). */
export const CHAIN_TARGET = Number(import.meta.env?.VITE_CHAIN_TARGET ?? 10);
/** Максимум зачётов с одной цепи: ровно ×1 или ×2 от цели, бесконтрольный фарм запрещён. */
export const MAX_CHAIN_UNITS = 2;
/** Потолок суммы цепи (и для обрезки выделения, и для проверки проходимости). */
export const CHAIN_SUM_CAP = CHAIN_TARGET * MAX_CHAIN_UNITS;
/** Бонус времени за двойную цепь. */
export const CHAIN_TIME_BONUS_MS = 10_000;

/** Нейминг варианта. */
export const GAME_NAME = CHAIN_TARGET === 12 ? 'Дюжина' : 'Десятка';
export const UNIT_SHORT = CHAIN_TARGET === 12 ? 'дюж.' : 'дес.';
export const UNIT_WORD = CHAIN_TARGET === 12 ? 'дюжин' : 'десяток';

/**
 * Сложность определяется размером поля (единственная ось):
 * уровень 1 — поле BASE_COLS×(BASE_COLS+ROWS_OFFSET) и номиналы 1..BASE_MAX_TILE;
 * каждые LEVELS_PER_SIZE уровней добавляется +1 колонка, +1 ряд и +1 номинал
 * до плато (MAX_COLS, MAX_TILE).
 */
export const BASE_COLS = 5;
export const MAX_COLS = 9;
export const ROWS_OFFSET = 3;
export const BASE_MAX_TILE = 5;
/** Сколько уровней поле держит один размер. */
export const LEVELS_PER_SIZE = 2;

/** Веса номиналов: 1–5 равновероятны, старшие — тем реже, чем крупнее. */
export const TILE_WEIGHTS: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
  6: 0.55, 7: 0.4, 8: 0.3, 9: 0.2,
};

/** Цель уровня в зачётах; игроку показываются очки = зачёты × CHAIN_TARGET.
 *  10/15/20... зачётов = круглые 100/150/200... очков. */
export const BASE_GOAL = 10;
export const GOAL_STEP = 5;
export const MAX_GOAL = 50;

/** Время уровня: time(level) = max(BASE_TIME - (level-1)*TIME_STEP, MIN_TIME). */
export const BASE_TIME_MS = 90_000;
export const TIME_STEP_MS = 10_000;
export const MIN_TIME_MS = 60_000;

/** Огонёк: цепь на две дюжины зажигает огонь ×FIRE_MULT на FIRE_DURATION_MS.
 *  Пока горит — все цепочки идут с множителем; новая 24-цепь перезапускает таймер.
 *  Гаснет только по времени. */
export const FIRE_MIN_K = 2;
export const FIRE_MULT = 2;
export const FIRE_DURATION_MS = 10_000;

/** Зеро — зелёная клетка с номиналом 0. Появляется с ZERO_START_LEVEL, на поле
 *  одновременно не больше maxZeros(level): 1 шт., каждые ZERO_STEP_LEVELS уровней +1.
 *  Цепочка с зеро идёт сразу с множителем огня и зажигает/перезапускает огонёк. */
export const ZERO_START_LEVEL = 8;
export const ZERO_STEP_LEVELS = 12;
/** Шанс зеро на каждую новую клетку (генерация и досыпка), пока не упёрлись в лимит. */
export const ZERO_SPAWN_CHANCE = 0.06;

/** Штраф за неуспешную попытку (невалидная цепь при отпускании). Подряд (внутри окна) —
 *  эскалация: 1с, 2с, 3с... Сбрасывается паузой или валидной цепью. */
export const FAIL_PENALTY_MS = 1_000;
export const FAIL_SPAM_WINDOW_MS = 2_000;

/** Продолжение после таймаута: +30 сек, не больше одного за раунд. */
export const EXTENSION_MS = 30_000;

/** Гемы: стартовый подарок, цена продолжения, награда за rewarded-рекламу. */
export const GEMS_START = 30;
export const CONTINUE_COST_GEMS = 10;
export const GEMS_PER_REWARDED = 5;

/** Перегенерации досыпки до принудительной связки. */
export const REFILL_ATTEMPTS = 25;

/** Бюджет узлов DFS поиска цепочки (сверх — считаем, что путь есть). */
export const PATH_SEARCH_BUDGET = 120_000;
