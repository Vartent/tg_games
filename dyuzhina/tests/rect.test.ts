import { describe, it, expect } from 'vitest';
import { normRect, rectSum, isValidRect, cellsInRect, applyRect, hasAnyValidRect } from '../src/game';
import { board } from './helpers';

describe('normRect', () => {
  it('нормализует углы в любом порядке', () => {
    expect(normRect({ r: 3, c: 5 }, { r: 1, c: 2 })).toEqual({ r1: 1, c1: 2, r2: 3, c2: 5 });
    expect(normRect({ r: 0, c: 0 }, { r: 0, c: 0 })).toEqual({ r1: 0, c1: 0, r2: 0, c2: 0 });
  });
});

describe('rectSum / isValidRect', () => {
  // 1 9 2
  // 3 4 5
  const b = board(['192', '345']);

  it('считает сумму рамки', () => {
    expect(rectSum(b, normRect({ r: 0, c: 0 }, { r: 0, c: 1 }))).toBe(10); // 1+9
    expect(rectSum(b, normRect({ r: 0, c: 0 }, { r: 1, c: 1 }))).toBe(17); // 1+9+3+4
  });

  it('рамка с суммой ровно 10 валидна, иначе нет', () => {
    expect(isValidRect(b, normRect({ r: 0, c: 0 }, { r: 0, c: 1 }))).toBe(true);
    expect(isValidRect(b, normRect({ r: 0, c: 0 }, { r: 1, c: 0 }))).toBe(false); // 1+3=4
    expect(isValidRect(b, normRect({ r: 0, c: 0 }, { r: 1, c: 1 }))).toBe(false); // 17
  });

  it('одна клетка рамкой не лопается (цифры < 10)', () => {
    expect(isValidRect(b, normRect({ r: 1, c: 2 }, { r: 1, c: 2 }))).toBe(false); // 5
  });

  it('рамка за границами невалидна', () => {
    expect(isValidRect(b, { r1: -1, c1: 0, r2: 0, c2: 1 })).toBe(false);
    expect(isValidRect(b, { r1: 0, c1: 0, r2: 5, c2: 1 })).toBe(false);
  });

  it('пустоты внутри рамки дают 0 — мосты через вычищенное', () => {
    // 5 . 5 — рамка через дыру валидна
    const withHole = board(['5.5']);
    expect(isValidRect(withHole, normRect({ r: 0, c: 0 }, { r: 0, c: 2 }))).toBe(true);
  });
});

describe('applyRect', () => {
  it('лопает непустые клетки, пустоты остаются пустотами', () => {
    const b = board(['5.5', '123']);
    const { board: next, popped } = applyRect(b, normRect({ r: 0, c: 0 }, { r: 0, c: 2 }));
    expect(popped).toHaveLength(2);
    expect(next[0]).toEqual([null, null, null]);
    expect(next[1]).toEqual([1, 2, 3]); // не задеты
    expect(b[0]![0]).toBe(5); // вход не мутируется
  });

  it('зеро лопается вместе с рамкой', () => {
    const b = board(['190']);
    const { popped } = applyRect(b, normRect({ r: 0, c: 0 }, { r: 0, c: 2 }));
    expect(popped).toHaveLength(3); // 1, 9 и зеро
  });
});

describe('hasAnyValidRect', () => {
  it('находит валидную рамку', () => {
    expect(hasAnyValidRect(board(['19', '23']))).toBe(true); // 1+9
    expect(hasAnyValidRect(board(['11', '53']))).toBe(true); // вся рамка 2×2 = 10
  });

  it('на доске из девяток ходов нет', () => {
    expect(hasAnyValidRect(board(['999', '999']))).toBe(false);
  });

  it('пустая доска — ходов нет', () => {
    expect(hasAnyValidRect(board(['...', '...']))).toBe(false);
  });

  it('рамка через пустоты учитывается', () => {
    expect(hasAnyValidRect(board(['5.5']))).toBe(true);
    expect(hasAnyValidRect(board(['9.9']))).toBe(false);
  });
});
