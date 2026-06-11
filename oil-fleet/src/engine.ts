/**
 * Игровая логика «Флотилии». Чистые функции: не мутируют вход, возвращают новое состояние.
 * Время (now, ms) и случайность (rng) передаются параметрами — никаких Date.now()/Math.random().
 * Нарушения правил — throw new EngineError(code).
 *
 * ВСЕ ФУНКЦИИ — СТАБЫ. Реализация по TDD: см. README, порядок — economy -> grid -> merge ->
 * production -> spill -> tanker -> helicopter -> offline -> streak -> persistence.
 */
import type { GameState, Rng } from './types';

const TODO = (): never => {
  throw new Error('Not implemented');
};

// ===== Формулы (economy) =====

/** Добыча вышки, баррелей/сек, с учётом экипажа (без учёта пятен). SPEC §3.1. */
export function rigRate(tier: number, crew: number): number {
  return TODO();
}

/** Кап склада вышки, баррелей. SPEC §3.1. */
export function storageCap(tier: number): number {
  return TODO();
}

/** Глубина бурения, метров. SPEC §3.1. */
export function rigDepth(tier: number): number {
  return TODO();
}

/** Цена следующей вышки T1. SPEC §3.1. */
export function rigPrice(state: GameState): number {
  return TODO();
}

/** Цена следующего слота сетки. SPEC §3.3. */
export function slotPrice(state: GameState): number {
  return TODO();
}

/** Ёмкость танкера уровня level. SPEC §3.4. */
export function tankerCapacity(level: number): number {
  return TODO();
}

/** Цена апгрейда танкера с уровня level на level+1. SPEC §3.4. */
export function tankerUpgradePrice(level: number): number {
  return TODO();
}

// ===== Состояние и сетка =====

/** Начальное состояние: INITIAL_COINS монет, пустая сетка (12 открытых ячеек),
 *  один танкер уровня 0 у причала, пустой пул рабочих, вертолёт через HELI_INTERVAL_MS. */
export function createInitialState(now: number): GameState {
  return TODO();
}

/** Купить вышку T1 в открытую пустую ячейку. */
export function buyRig(state: GameState, cell: number): GameState {
  return TODO();
}

/** Купить (разблокировать) закрытую ячейку. */
export function buySlot(state: GameState, cell: number): GameState {
  return TODO();
}

// ===== Merge =====

/** Слить вышку из fromCell в toCell (одинаковый тир). Результат — в toCell, fromCell пустеет.
 *  Экипаж и нефть объединяются по правилам SPEC §3.2. */
export function mergeRigs(state: GameState, fromCell: number, toCell: number): GameState {
  return TODO();
}

// ===== Производство (tick) =====

/**
 * Обсчитать игру с state.lastTickAt до now: добыча в склады (экипаж, пятна, капы),
 * отметка fullSince, появление пятен (онлайн — без лимита MAX_OFFLINE_SPILLS),
 * возврат танкеров с зачислением выручки, прилёты вертолёта.
 */
export function tick(state: GameState, now: number, rng: Rng): GameState {
  return TODO();
}

// ===== Разливы =====

/** Тап чистки пятна. Пятый тап удаляет пятно. */
export function tapSpill(state: GameState, spillId: number): GameState {
  return TODO();
}

/** Активен ли замедляющий эффект пятна для вышки в ячейке cell (4-соседство). */
export function isSlowedBySpill(state: GameState, cell: number): boolean {
  return TODO();
}

// ===== Танкер =====

/** Перелить нефть со склада вышки в пришвартованный танкер (сколько влезет). */
export function loadTanker(state: GameState, tankerId: number, rigCell: number): GameState {
  return TODO();
}

/** Отправить загруженный танкер в рейс. Выручка зачислится в tick при возвращении. */
export function dispatchTanker(state: GameState, tankerId: number, now: number): GameState {
  return TODO();
}

/** Апгрейд ёмкости танкера. */
export function upgradeTanker(state: GameState, tankerId: number): GameState {
  return TODO();
}

/** Купить второй танкер. */
export function buyTanker(state: GameState): GameState {
  return TODO();
}

// ===== Вертолёт / экипаж =====

/** Назначить рабочего из пула на вышку. */
export function assignWorker(state: GameState, rigCell: number): GameState {
  return TODO();
}

// ===== Оффлайн =====

/**
 * Обсчитать оффлайн-период от state.lastTickAt до now (учитывается максимум OFFLINE_CAP_MS):
 * добыча до капов, не более MAX_OFFLINE_SPILLS новых пятен (в порядке возрастания индекса ячейки),
 * возврат танкеров, прилёты вертолёта.
 */
export function applyOffline(state: GameState, now: number, rng: Rng): GameState {
  return TODO();
}

// ===== Дейли-стрик =====

/** UTC-день для момента времени, YYYY-MM-DD. */
export function utcDay(now: number): string {
  return TODO();
}

/** Клейм дейли-награды. Подарочная вышка — в свободную ячейку или в очередь подарков. */
export function claimDailyStreak(state: GameState, now: number): GameState {
  return TODO();
}

// ===== Сериализация =====

export function serialize(state: GameState): string {
  return TODO();
}

/** Бросает EngineError('INVALID_SAVE') на мусоре. */
export function deserialize(raw: string): GameState {
  return TODO();
}
