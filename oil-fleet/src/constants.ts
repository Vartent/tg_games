/** Все числа экономики. Единый источник правды — SPEC.md §3. */

export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const GRID_SIZE = GRID_COLS * GRID_ROWS;
/** Ячейки 0..11 открыты со старта, 12..15 покупаются. */
export const INITIAL_UNLOCKED_CELLS = 12;

export const MAX_TIER = 12;

/** Базовая добыча T1, баррелей/сек. */
export const BASE_RATE = 1;
/** Множитель добычи за тир. */
export const RATE_GROWTH = 2.2;
/** Кап склада вышки = rate(tier) * STORAGE_SECONDS. */
export const STORAGE_SECONDS = 7200;
/** Глубина бурения (презентация): DEPTH_FACTOR * tier^2, метров. */
export const DEPTH_FACTOR = 40;

/** Цена первой вышки T1 и рост цены за каждую покупку. */
export const RIG_BASE_PRICE = 50;
export const RIG_PRICE_GROWTH = 1.07;

/** Цена слота сетки: SLOT_BASE_PRICE * SLOT_PRICE_GROWTH^куплено. */
export const SLOT_BASE_PRICE = 1000;
export const SLOT_PRICE_GROWTH = 3;

/** Коэффициент экипажа: CREW_MIN_FACTOR + (1 - CREW_MIN_FACTOR) * crew / tier. */
export const CREW_MIN_FACTOR = 0.5;

/** Танкер. */
export const TANKER_BASE_CAPACITY = 500;
export const TANKER_CAPACITY_GROWTH = 1.5;
export const TANKER_UPGRADE_BASE_PRICE = 400;
export const TANKER_UPGRADE_PRICE_GROWTH = 2.5;
export const TANKER_TRIP_MS = 90_000;
export const SECOND_TANKER_PRICE = 25_000;
export const MAX_TANKERS = 2;
/** Монет за баррель. */
export const OIL_PRICE = 1;

/** Разлив: склад полон непрерывно >= SPILL_GRACE_MS -> пятно. */
export const SPILL_GRACE_MS = 600_000;
/** Замедление соседних вышек активным пятном. */
export const SPILL_SLOW_FACTOR = 0.5;
/** Тапов для чистки пятна. */
export const SPILL_TAPS_TO_CLEAN = 5;
/** Максимум новых пятен за один оффлайн-период. */
export const MAX_OFFLINE_SPILLS = 2;

/** Вертолёт. */
export const HELI_INTERVAL_MS = 3 * 3600_000;
export const HELI_WORKERS_PER_TRIP = 2;
export const WORKER_POOL_CAP = 6;

/** Оффлайн учитывается максимум на этот период. */
export const OFFLINE_CAP_MS = 12 * 3600_000;

/** Награда дейли-стрика: тир вышки по дню стрика (1-й..7-й+). */
export const STREAK_REWARD_TIERS = [1, 1, 2, 2, 3, 3, 4] as const;

export const INITIAL_COINS = 100;
