import { describe, it, expect } from 'vitest';
import {
  createRng, generateBoard, hasAnyUnitPath, levelCols, levelRows, levelMaxTile,
} from '../src/game';
import * as C from '../src/constants';

describe('PRNG', () => {
  it('детерминирован: одинаковый seed -> одинаковая последовательность', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('разные seed -> разные последовательности', () => {
    const seqA = Array.from({ length: 10 }, createRng(1));
    const seqB = Array.from({ length: 10 }, createRng(2));
    expect(seqA).not.toEqual(seqB);
  });

  it('значения в [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('размер поля и номиналы по уровню (единственная ось сложности)', () => {
  it('уровень 1: поле 5×8, номиналы до 5', () => {
    expect(levelCols(1)).toBe(5);
    expect(levelRows(1)).toBe(8);
    expect(levelMaxTile(1)).toBe(5);
  });

  it('каждый уровень: +1 колонка, +1 ряд, +1 номинал', () => {
    expect([levelCols(2), levelRows(2), levelMaxTile(2)]).toEqual([6, 9, 6]);
    expect([levelCols(3), levelRows(3), levelMaxTile(3)]).toEqual([7, 10, 7]);
    expect([levelCols(4), levelRows(4), levelMaxTile(4)]).toEqual([8, 11, 8]);
  });

  it('плато с 5-го уровня: 9×12, номиналы до 9', () => {
    expect([levelCols(5), levelRows(5), levelMaxTile(5)]).toEqual([9, 12, 9]);
    expect([levelCols(50), levelRows(50), levelMaxTile(50)]).toEqual([9, 12, 9]);
  });
});

describe('генерация доски', () => {
  it('размер доски соответствует уровню', () => {
    for (const level of [1, 3, 7]) {
      const b = generateBoard(1, level);
      expect(b).toHaveLength(levelRows(level));
      for (const row of b) expect(row).toHaveLength(levelCols(level));
    }
  });

  it('номиналы не превышают потолок уровня', () => {
    for (const level of [1, 2, 5]) {
      const max = levelMaxTile(level);
      for (const tile of generateBoard(7, level).flat()) {
        expect(tile).toBeGreaterThanOrEqual(C.MIN_TILE);
        expect(tile).toBeLessThanOrEqual(max);
      }
    }
  });

  it('детерминирована по seed', () => {
    expect(generateBoard(555, 5)).toEqual(generateBoard(555, 5));
    expect(generateBoard(555, 5)).not.toEqual(generateBoard(556, 5));
  });

  it('на свежей доске любого уровня есть дюжинная цепочка', () => {
    for (const level of [1, 3, 8]) {
      for (let seed = 0; seed < 10; seed++) {
        expect(hasAnyUnitPath(generateBoard(seed, level)), `level=${level} seed=${seed}`).toBe(true);
      }
    }
  });
});

describe('распределение номиналов', () => {
  it('распределение следует TILE_WEIGHTS (сейчас равномерное: каждый номинал ~1/9 ± допуск)', () => {
    const counts = new Array(10).fill(0) as number[];
    for (let seed = 100; seed < 115; seed++) {
      for (const tile of generateBoard(seed, 5).flat()) counts[tile as number] = (counts[tile as number] ?? 0) + 1;
    }
    const total = counts.reduce((a, b) => a + b, 0);
    const weightTotal = Object.values(C.TILE_WEIGHTS).reduce((a, b) => a + b, 0);
    for (let d = 1; d <= 9; d++) {
      const expected = (C.TILE_WEIGHTS[d] ?? 1) / weightTotal;
      expect(counts[d]! / total, `номинал ${d}`).toBeGreaterThan(expected * 0.6);
      expect(counts[d]! / total, `номинал ${d}`).toBeLessThan(expected * 1.5);
    }
  });
});
