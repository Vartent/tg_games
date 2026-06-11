import { describe, it, expect } from 'vitest';
import { findGroups, isValidSwap, hasAnyValidSwap, swapBoard, isOrthAdjacent } from '../src/game';
import { board } from './helpers';

describe('findGroups: отрезки с суммой 10', () => {
  it('горизонтальная пара 1+9', () => {
    const groups = findGroups(board(['19', '23']));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }]);
  });

  it('горизонтальная тройка 2+3+5', () => {
    const groups = findGroups(board(['235', '111']));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('вертикальная пара', () => {
    const groups = findGroups(board(['12', '93']));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual([{ r: 0, c: 0 }, { r: 1, c: 0 }]);
  });

  it('зеро не меняет сумму: 1+9 и 1+9+0 — два отрезка', () => {
    const groups = findGroups(board(['190', '222']));
    expect(groups).toHaveLength(2);
  });

  it('пустая клетка разрывает отрезок', () => {
    expect(findGroups(board(['1.9']))).toHaveLength(0);
  });

  it('нет десяток — нет отрезков', () => {
    expect(findGroups(board(['12', '34']))).toHaveLength(0);
  });

  it('сумма больше 10 не лопается (9+9=18)', () => {
    expect(findGroups(board(['99', '99']))).toHaveLength(0);
  });
});

describe('isValidSwap', () => {
  // [[4,5],[5,6]] — без готовых отрезков
  const b = board(['45', '56']);

  it('свап, создающий вертикальную десятку, валиден', () => {
    expect(isValidSwap(b, { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } })).toBe(true); // -> col0: 5+5
  });

  it('свап без лопанья невалиден', () => {
    expect(isValidSwap(board(['12', '34']), { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } })).toBe(false);
  });

  it('диагональ и не-соседи невалидны', () => {
    expect(isOrthAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false);
    expect(isValidSwap(b, { a: { r: 0, c: 0 }, b: { r: 1, c: 1 } })).toBe(false);
    expect(isValidSwap(b, { a: { r: 0, c: 0 }, b: { r: 0, c: 0 } })).toBe(false);
  });

  it('за доской и с пустой клеткой невалидно', () => {
    expect(isValidSwap(b, { a: { r: -1, c: 0 }, b: { r: 0, c: 0 } })).toBe(false);
    expect(isValidSwap(board(['4.', '56']), { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } })).toBe(false);
  });

  it('swapBoard не мутирует вход', () => {
    const before = board(['45', '56']);
    const after = swapBoard(before, { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } });
    expect(before).toEqual(board(['45', '56']));
    expect(after).toEqual(board(['54', '56']));
  });
});

describe('hasAnyValidSwap', () => {
  it('находит доступный свап', () => {
    expect(hasAnyValidSwap(board(['45', '56']))).toBe(true);
  });

  it('на доске из девяток ходов нет', () => {
    expect(hasAnyValidSwap(board(['999', '999', '999']))).toBe(false);
  });
});
