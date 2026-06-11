import { describe, it, expect } from 'vitest';
import { generateBoard, hasAnyValidRect, countZeros, maxZeros, levelGoal } from '../src/game';
import * as C from '../src/constants';

describe('генерация поля', () => {
  it('размер как в оригинале: 17 рядов × 10 колонок', () => {
    const b = generateBoard(42);
    expect(b).toHaveLength(C.ROWS);
    for (const row of b) expect(row).toHaveLength(C.COLS);
  });

  it('детерминирована по seed', () => {
    expect(generateBoard(42)).toEqual(generateBoard(42));
    expect(generateBoard(42)).not.toEqual(generateBoard(43));
  });

  it('цифры 1..9, без зеро при zeroCap=0', () => {
    for (let seed = 0; seed < 5; seed++) {
      for (const tile of generateBoard(seed).flat()) {
        expect(tile).toBeGreaterThanOrEqual(1);
        expect(tile).toBeLessThanOrEqual(9);
      }
    }
  });

  it('на свежем поле всегда есть ход', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(hasAnyValidRect(generateBoard(seed))).toBe(true);
    }
  });

  it('зеро — не больше zeroCap', () => {
    for (let seed = 0; seed < 5; seed++) {
      expect(countZeros(generateBoard(seed, 1))).toBeLessThanOrEqual(1);
      expect(countZeros(generateBoard(seed, 2))).toBeLessThanOrEqual(2);
    }
  });
});

describe('параметры уровней', () => {
  it('цель растёт клетками и упирается в кап', () => {
    expect(levelGoal(1)).toBe(40);
    expect(levelGoal(2)).toBe(48);
    expect(levelGoal(10)).toBe(C.MAX_GOAL);
    expect(levelGoal(50)).toBe(C.MAX_GOAL);
  });

  it('зеро: с 8-го уровня один, с 20-го два', () => {
    expect(maxZeros(1)).toBe(0);
    expect(maxZeros(7)).toBe(0);
    expect(maxZeros(8)).toBe(1);
    expect(maxZeros(19)).toBe(1);
    expect(maxZeros(20)).toBe(2);
  });
});
