import { describe, it, expect } from 'vitest';
import { createInitialState, buyRig, buySlot, rigPrice, slotPrice } from '../src/engine';
import { EngineError } from '../src/types';
import * as C from '../src/constants';

describe('начальное состояние', () => {
  const s = createInitialState(1000);

  it('стартовые монеты, пустая сетка, один танкер у причала', () => {
    expect(s.coins).toBe(C.INITIAL_COINS);
    expect(s.rigs).toHaveLength(0);
    expect(s.spills).toHaveLength(0);
    expect(s.tankers).toHaveLength(1);
    expect(s.tankers[0]!.status).toBe('docked');
    expect(s.tankers[0]!.loaded).toBe(0);
    expect(s.tankers[0]!.level).toBe(0);
  });

  it('открыто 12 ячеек: 0..11', () => {
    expect(s.unlockedCells).toHaveLength(C.INITIAL_UNLOCKED_CELLS);
    expect([...s.unlockedCells].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i),
    );
  });

  it('пул рабочих пуст, вертолёт прилетит через HELI_INTERVAL_MS', () => {
    expect(s.workerPool).toBe(0);
    expect(s.nextHeliAt).toBe(1000 + C.HELI_INTERVAL_MS);
  });
});

describe('покупка вышки', () => {
  it('покупка T1: списывает цену, ставит вышку с экипажем 1 и пустым складом', () => {
    const s0 = createInitialState(0);
    const s1 = buyRig(s0, 5);
    expect(s1.coins).toBeCloseTo(C.INITIAL_COINS - C.RIG_BASE_PRICE);
    expect(s1.rigs).toHaveLength(1);
    const rig = s1.rigs[0]!;
    expect(rig.cell).toBe(5);
    expect(rig.tier).toBe(1);
    expect(rig.crew).toBe(1);
    expect(rig.storage).toBe(0);
    expect(s1.rigsPurchased).toBe(1);
  });

  it('не мутирует исходное состояние', () => {
    const s0 = createInitialState(0);
    buyRig(s0, 5);
    expect(s0.rigs).toHaveLength(0);
    expect(s0.coins).toBe(C.INITIAL_COINS);
  });

  it('цена следующей вышки выросла после покупки', () => {
    const s1 = buyRig(createInitialState(0), 0);
    expect(rigPrice(s1)).toBeCloseTo(C.RIG_BASE_PRICE * C.RIG_PRICE_GROWTH);
  });

  it('нельзя купить в занятую ячейку', () => {
    const s1 = buyRig(createInitialState(0), 0);
    const s2 = { ...s1, coins: 10_000 };
    expect(() => buyRig(s2, 0)).toThrowError(new EngineError('CELL_OCCUPIED'));
  });

  it('нельзя купить в закрытую ячейку', () => {
    expect(() => buyRig(createInitialState(0), 13)).toThrowError(new EngineError('CELL_LOCKED'));
  });

  it('нельзя купить без денег', () => {
    const s = { ...createInitialState(0), coins: C.RIG_BASE_PRICE - 1 };
    expect(() => buyRig(s, 0)).toThrowError(new EngineError('NOT_ENOUGH_COINS'));
  });
});

describe('покупка слота', () => {
  it('разблокирует ячейку и списывает цену', () => {
    const s0 = { ...createInitialState(0), coins: 5000 };
    const s1 = buySlot(s0, 13);
    expect(s1.unlockedCells).toContain(13);
    expect(s1.coins).toBeCloseTo(5000 - C.SLOT_BASE_PRICE);
    expect(s1.slotsPurchased).toBe(1);
    expect(slotPrice(s1)).toBeCloseTo(C.SLOT_BASE_PRICE * 3);
  });

  it('нельзя купить уже открытую ячейку', () => {
    const s = { ...createInitialState(0), coins: 5000 };
    expect(() => buySlot(s, 3)).toThrowError(new EngineError('CELL_ALREADY_UNLOCKED'));
  });

  it('нельзя купить без денег', () => {
    const s = { ...createInitialState(0), coins: C.SLOT_BASE_PRICE - 1 };
    expect(() => buySlot(s, 13)).toThrowError(new EngineError('NOT_ENOUGH_COINS'));
  });
});
