/** Типы игрового состояния. Состояние — plain JSON-сериализуемый объект. */

/** Детерминированный источник случайности: число в [0, 1). */
export type Rng = () => number;

export interface Rig {
  id: number;
  /** Индекс ячейки сетки 0..GRID_SIZE-1. */
  cell: number;
  /** 1..MAX_TIER */
  tier: number;
  /** Рабочих на вышке, 0..tier. */
  crew: number;
  /** Нефть на складе вышки, баррелей. */
  storage: number;
  /** Момент (ms), с которого склад непрерывно полон; null, если не полон. */
  fullSince: number | null;
}

export interface Spill {
  id: number;
  /** Ячейка вышки-источника. */
  cell: number;
  /** Сделано тапов чистки (пятно исчезает при SPILL_TAPS_TO_CLEAN). */
  taps: number;
}

export type TankerStatus = 'docked' | 'enRoute';

export interface Tanker {
  id: number;
  /** Уровень ёмкости, 0 = базовый. */
  level: number;
  /** Загружено нефти, баррелей. */
  loaded: number;
  status: TankerStatus;
  /** Момент возвращения (ms), если в рейсе. */
  returnsAt: number | null;
}

export interface StreakState {
  /** Текущая длина стрика (0 = ещё не клеймился ни разу). */
  days: number;
  /** UTC-день последнего клейма в формате YYYY-MM-DD, null если не было. */
  lastClaimDay: string | null;
}

export interface GameState {
  coins: number;
  rigs: Rig[];
  spills: Spill[];
  tankers: Tanker[];
  /** Открытые ячейки сетки (индексы). */
  unlockedCells: number[];
  /** Сколько вышек T1 куплено за всё время (для цены). */
  rigsPurchased: number;
  /** Сколько слотов докуплено (для цены). */
  slotsPurchased: number;
  /** Свободные рабочие в пуле. */
  workerPool: number;
  /** Момент следующего прилёта вертолёта (ms). */
  nextHeliAt: number;
  /** Очередь подарочных вышек (тиры), ждущих свободную ячейку. */
  pendingGiftTiers: number[];
  streak: StreakState;
  /** Момент последнего обсчёта tick/offline (ms). */
  lastTickAt: number;
  /** Автоинкремент id сущностей. */
  nextEntityId: number;
}

/** Ошибка нарушения игровых правил. */
export class EngineError extends Error {
  constructor(public code: EngineErrorCode) {
    super(code);
    this.name = 'EngineError';
  }
}

export type EngineErrorCode =
  | 'NOT_ENOUGH_COINS'
  | 'CELL_OCCUPIED'
  | 'CELL_LOCKED'
  | 'CELL_EMPTY'
  | 'CELL_ALREADY_UNLOCKED'
  | 'TIER_MISMATCH'
  | 'MAX_TIER_REACHED'
  | 'SAME_CELL'
  | 'TANKER_NOT_DOCKED'
  | 'TANKER_EMPTY'
  | 'TANKER_NOT_FOUND'
  | 'MAX_TANKERS_REACHED'
  | 'SPILL_NOT_FOUND'
  | 'NO_WORKERS_IN_POOL'
  | 'CREW_FULL'
  | 'ALREADY_CLAIMED_TODAY'
  | 'INVALID_SAVE';
