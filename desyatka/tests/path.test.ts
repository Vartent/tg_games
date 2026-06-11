import { describe, it, expect } from 'vitest';
import { pathSum, isValidPath, unitsIn, hasAnyUnitPath } from '../src/game';
import { board } from './helpers';

// верхний левый угол (фон — девятки):
// 3 7 1
// 2 5 9
// 4 . 8
const b = board(['371', '259', '4.8']);

describe('pathSum / unitsIn', () => {
  it('суммирует цепочку', () => {
    expect(pathSum(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }])).toBe(10); // 3+7
    expect(pathSum(b, [{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }])).toBe(9); // 3+2+4
  });

  it('зачёты: ровно 10 или 20, больше двух с цепи не бывает', () => {
    expect(unitsIn(10)).toBe(1);
    expect(unitsIn(20)).toBe(2);
    expect(unitsIn(30)).toBe(0); // фарм 3+ зачётов запрещён
    expect(unitsIn(40)).toBe(0);
    expect(unitsIn(12)).toBe(0);
    expect(unitsIn(13)).toBe(0);
    expect(unitsIn(0)).toBe(0);
  });
});

describe('isValidPath', () => {
  it('пара с суммой 10 валидна', () => {
    expect(isValidPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }])).toBe(true); // 3+7
  });

  it('цепочка на 20 (два зачёта) валидна', () => {
    // 1 (0,2) -> 9 (1,2) -> 5 (1,1) -> 2 (1,0) -> 3 (0,0) = 20 ✓ (изгиб змейки)
    expect(
      isValidPath(b, [{ r: 0, c: 2 }, { r: 1, c: 2 }, { r: 1, c: 1 }, { r: 1, c: 0 }, { r: 0, c: 0 }]),
    ).toBe(true);
  });

  it('сумма не кратна 10 — невалидно', () => {
    expect(isValidPath(b, [{ r: 0, c: 0 }, { r: 1, c: 0 }])).toBe(false); // 5
    expect(isValidPath(b, [{ r: 1, c: 1 }, { r: 1, c: 2 }])).toBe(false); // 14
  });

  it('диагональные шаги невалидны (только 4-соседство)', () => {
    // 3 (0,0) -> 5 (1,1): сумма 10 не спасает — шаг по диагонали
    expect(isValidPath(b, [{ r: 0, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 0 }])).toBe(false);
  });

  it('несоседние клетки — невалидно', () => {
    // 3 (0,0) и 1 (0,2) не соседи, хотя 3+1+... могла бы дать 10
    expect(isValidPath(b, [{ r: 0, c: 0 }, { r: 0, c: 2 }, { r: 1, c: 2 }])).toBe(false);
  });

  it('повтор клетки — невалидно', () => {
    expect(isValidPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 0 }])).toBe(false);
  });

  it('пустая клетка в цепочке — невалидно', () => {
    // (2,1) пустая; 4+null+8 даже не доберёт
    expect(isValidPath(b, [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }])).toBe(false);
  });

  it('выход за доску и пустая цепочка — невалидно', () => {
    expect(isValidPath(b, [{ r: -1, c: 0 }, { r: 0, c: 0 }])).toBe(false);
    expect(isValidPath(b, [])).toBe(false);
  });
});

describe('hasAnyUnitPath', () => {
  it('находит пару 1+9 на фоне девяток', () => {
    expect(hasAnyUnitPath(board(['19']))).toBe(true);
  });

  it('девятки непроходимы (9, 18, 27 — мимо 10/20)', () => {
    expect(hasAnyUnitPath(board([]))).toBe(false);
  });

  it('пятёрки проходимы: 5+5 = 10', () => {
    expect(hasAnyUnitPath(board([], '5'))).toBe(true);
  });

  it('доска из восьмёрок непроходима (8, 16, 24 — мимо 10/20)', () => {
    expect(hasAnyUnitPath(board([], '8'))).toBe(false);
  });
});
