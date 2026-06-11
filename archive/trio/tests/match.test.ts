import { describe, it, expect } from 'vitest';
import { findGroups, isValidSwap, hasAnyValidSwap, swapBoard, isOrthAdjacent } from '../src/game';
import { board } from './helpers';

describe('findGroups: тройки с суммой 10', () => {
  it('горизонтальная тройка 2+3+5', () => {
    const groups = findGroups(board(['235', '111'])); // вертикальных окон из 3 нет (2 ряда)
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual([{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }]);
  });

  it('вертикальная тройка 1+4+5', () => {
    const groups = findGroups(board(['12', '42', '52']));
    expect(groups).toHaveLength(1);
    expect(groups[0]).toEqual([{ r: 0, c: 0 }, { r: 1, c: 0 }, { r: 2, c: 0 }]);
  });

  it('пара 1+9 — НЕ группа (только тройки)', () => {
    expect(findGroups(board(['19', '23']))).toHaveLength(0);
  });

  it('четвёрка с суммой 10 — не группа, если ни одно окно из 3 не даёт 10', () => {
    expect(findGroups(board(['1234']))).toHaveLength(0); // 1+2+3=6, 2+3+4=9
  });

  it('зеро не меняет сумму: 1+9+0 — тройка', () => {
    const groups = findGroups(board(['190', '222']));
    expect(groups).toHaveLength(1);
  });

  it('пересекающиеся тройки: 1+4+5 и 4+5+1', () => {
    expect(findGroups(board(['1451', '2222']))).toHaveLength(2);
  });

  it('пустая клетка разрывает тройку', () => {
    expect(findGroups(board(['2.8']))).toHaveLength(0);
  });

  it('нет десяток — нет групп', () => {
    expect(findGroups(board(['123', '456', '788']))).toHaveLength(0);
  });
});

describe('isValidSwap', () => {
  // [[1,9],[4,8],[9,5]] — чисто: col0 14, col1 22, ряды короче тройки
  const b = board(['19', '48', '95']);

  it('свап, собирающий вертикальную тройку 1+4+5, валиден', () => {
    expect(isValidSwap(b, { a: { r: 2, c: 0 }, b: { r: 2, c: 1 } })).toBe(true); // 9<->5
  });

  it('свап без тройки невалиден', () => {
    expect(isValidSwap(b, { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } })).toBe(false); // 1<->9
  });

  it('диагональ и не-соседи невалидны', () => {
    expect(isOrthAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false);
    expect(isValidSwap(b, { a: { r: 0, c: 0 }, b: { r: 1, c: 1 } })).toBe(false);
    expect(isValidSwap(b, { a: { r: 0, c: 0 }, b: { r: 0, c: 0 } })).toBe(false);
  });

  it('за доской и с пустой клеткой невалидно', () => {
    expect(isValidSwap(b, { a: { r: -1, c: 0 }, b: { r: 0, c: 0 } })).toBe(false);
    expect(isValidSwap(board(['1.', '48', '95']), { a: { r: 0, c: 0 }, b: { r: 0, c: 1 } })).toBe(false);
  });

  it('swapBoard не мутирует вход', () => {
    const before = board(['19', '48', '95']);
    const after = swapBoard(before, { a: { r: 2, c: 0 }, b: { r: 2, c: 1 } });
    expect(before).toEqual(board(['19', '48', '95']));
    expect(after).toEqual(board(['19', '48', '59']));
  });
});

describe('hasAnyValidSwap', () => {
  it('находит доступный свап', () => {
    expect(hasAnyValidSwap(board(['19', '48', '95']))).toBe(true);
  });

  it('на доске из девяток ходов нет', () => {
    expect(hasAnyValidSwap(board(['999', '999', '999']))).toBe(false);
  });
});
