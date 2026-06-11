import { describe, it, expect } from 'vitest';
import {
  loadTanker, dispatchTanker, upgradeTanker, buyTanker, tick,
  tankerCapacity, tankerUpgradePrice,
} from '../src/engine';
import { EngineError } from '../src/types';
import { stateWithRigs, fixedRng } from './helpers';
import * as C from '../src/constants';

const tankerId = (s: ReturnType<typeof stateWithRigs>) => s.tankers[0]!.id;

describe('погрузка', () => {
  it('переливает весь склад вышки, если влезает', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 300 }]);
    const s1 = loadTanker(s0, tankerId(s0), 0);
    expect(s1.tankers[0]!.loaded).toBeCloseTo(300);
    expect(s1.rigs[0]!.storage).toBe(0);
  });

  it('переливает только до ёмкости танкера, остаток — на складе', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 2, storage: 700 }]);
    const s1 = loadTanker(s0, tankerId(s0), 0);
    expect(s1.tankers[0]!.loaded).toBeCloseTo(C.TANKER_BASE_CAPACITY);
    expect(s1.rigs[0]!.storage).toBeCloseTo(700 - C.TANKER_BASE_CAPACITY);
  });

  it('погрузка снимает fullSince, если склад перестал быть полным', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 400, fullSince: 123 }]);
    const s1 = loadTanker(s0, tankerId(s0), 0);
    expect(s1.rigs[0]!.fullSince).toBeNull();
  });

  it('нельзя грузить танкер в рейсе', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 100 }]);
    const enRoute = {
      ...s0,
      tankers: [{ ...s0.tankers[0]!, status: 'enRoute' as const, returnsAt: 99_999 }],
    };
    expect(() => loadTanker(enRoute, tankerId(s0), 0)).toThrowError(
      new EngineError('TANKER_NOT_DOCKED'),
    );
  });
});

describe('рейс и выручка', () => {
  it('отправка: статус enRoute, возврат через TANKER_TRIP_MS', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 200 }]);
    const s1 = loadTanker(s0, tankerId(s0), 0);
    const s2 = dispatchTanker(s1, tankerId(s0), 10_000);
    expect(s2.tankers[0]!.status).toBe('enRoute');
    expect(s2.tankers[0]!.returnsAt).toBe(10_000 + C.TANKER_TRIP_MS);
    // выручки при отправке нет
    expect(s2.coins).toBe(s1.coins);
  });

  it('пустой танкер не отправляется', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1 }]);
    expect(() => dispatchTanker(s0, tankerId(s0), 0)).toThrowError(
      new EngineError('TANKER_EMPTY'),
    );
  });

  it('возвращение в tick: монеты = загружено × OIL_PRICE, танкер снова docked и пуст', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 200 }], { lastTickAt: 0 });
    const s1 = dispatchTanker(loadTanker(s0, tankerId(s0), 0), tankerId(s0), 0);
    const s2 = tick(s1, C.TANKER_TRIP_MS + 1_000, fixedRng());
    expect(s2.coins).toBeCloseTo(s0.coins + 200 * C.OIL_PRICE);
    expect(s2.tankers[0]!.status).toBe('docked');
    expect(s2.tankers[0]!.loaded).toBe(0);
    expect(s2.tankers[0]!.returnsAt).toBeNull();
  });

  it('до истечения рейса танкер ещё в пути и денег нет', () => {
    const s0 = stateWithRigs([{ cell: 0, tier: 1, storage: 200 }], { lastTickAt: 0 });
    const s1 = dispatchTanker(loadTanker(s0, tankerId(s0), 0), tankerId(s0), 0);
    const s2 = tick(s1, C.TANKER_TRIP_MS - 1_000, fixedRng());
    expect(s2.tankers[0]!.status).toBe('enRoute');
    expect(s2.coins).toBe(s0.coins);
  });
});

describe('апгрейд и второй танкер', () => {
  it('апгрейд: уровень +1, монеты списаны', () => {
    const s0 = stateWithRigs([]);
    const s1 = upgradeTanker(s0, tankerId(s0));
    expect(s1.tankers[0]!.level).toBe(1);
    expect(s1.coins).toBeCloseTo(s0.coins - tankerUpgradePrice(0));
    expect(tankerCapacity(s1.tankers[0]!.level)).toBeCloseTo(
      C.TANKER_BASE_CAPACITY * C.TANKER_CAPACITY_GROWTH,
    );
  });

  it('апгрейд без денег — ошибка', () => {
    const s0 = { ...stateWithRigs([]), coins: 0 };
    expect(() => upgradeTanker(s0, s0.tankers[0]!.id)).toThrowError(
      new EngineError('NOT_ENOUGH_COINS'),
    );
  });

  it('покупка второго танкера', () => {
    const s0 = stateWithRigs([]);
    const s1 = buyTanker(s0);
    expect(s1.tankers).toHaveLength(2);
    expect(s1.coins).toBeCloseTo(s0.coins - C.SECOND_TANKER_PRICE);
    expect(s1.tankers[1]!.status).toBe('docked');
    expect(s1.tankers[1]!.level).toBe(0);
  });

  it('третий танкер не продаётся', () => {
    const s1 = buyTanker({ ...stateWithRigs([]), coins: 10_000_000 });
    expect(() => buyTanker(s1)).toThrowError(new EngineError('MAX_TANKERS_REACHED'));
  });
});
