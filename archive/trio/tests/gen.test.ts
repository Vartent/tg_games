import { describe, it, expect } from 'vitest';
import {
  generateBoard, findGroups, hasAnyValidSwap, countZeros, maxZeros,
  levelCols, levelRows, levelMaxTile, levelGoal, levelTime,
} from '../src/game';

describe('параметры уровней (как в «Десятке»)', () => {
  it('размер поля держится 2 уровня, плато с 9-го; номиналы до 9 с первого уровня', () => {
    expect([levelCols(1), levelRows(1), levelMaxTile(1)]).toEqual([5, 8, 9]);
    expect([levelCols(2), levelRows(2), levelMaxTile(2)]).toEqual([5, 8, 9]);
    expect([levelCols(3), levelRows(3), levelMaxTile(3)]).toEqual([6, 9, 9]);
    expect([levelCols(9), levelRows(9), levelMaxTile(9)]).toEqual([9, 12, 9]);
    expect([levelCols(50), levelRows(50), levelMaxTile(50)]).toEqual([9, 12, 9]);
  });

  it('цель и время', () => {
    expect(levelGoal(1)).toBe(10);
    expect(levelGoal(9)).toBe(50);
    expect(levelTime(1)).toBe(90_000);
    expect(levelTime(4)).toBe(60_000);
  });

  it('зеро: с 8-го уровня один, с 20-го два', () => {
    expect(maxZeros(7)).toBe(0);
    expect(maxZeros(8)).toBe(1);
    expect(maxZeros(20)).toBe(2);
  });
});

describe('генерация доски', () => {
  it('детерминирована по seed', () => {
    expect(generateBoard(42, 3)).toEqual(generateBoard(42, 3));
  });

  it('без готовых отрезков, с доступным свапом, размеры и зеро по уровню', () => {
    for (const level of [1, 3, 8, 20]) {
      for (let seed = 0; seed < 5; seed++) {
        const b = generateBoard(seed, level);
        expect(b, `level=${level} seed=${seed}`).toHaveLength(levelRows(level));
        expect(b[0]).toHaveLength(levelCols(level));
        expect(findGroups(b), `groups level=${level} seed=${seed}`).toHaveLength(0);
        expect(hasAnyValidSwap(b), `swap level=${level} seed=${seed}`).toBe(true);
        expect(countZeros(b)).toBeLessThanOrEqual(maxZeros(level));
        for (const row of b) {
          for (const tile of row) {
            expect(tile).not.toBeNull();
            expect(tile!).toBeLessThanOrEqual(levelMaxTile(level));
          }
        }
      }
    }
  });

  it('до 8-го уровня зеро не генерится', () => {
    for (let seed = 0; seed < 10; seed++) {
      expect(countZeros(generateBoard(seed, 7))).toBe(0);
    }
  });
});
