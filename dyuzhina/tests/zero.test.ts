import { describe, it, expect } from 'vitest';
import { playRect, isValidRect, isFireActive, normRect, countZeros, generateBoard } from '../src/game';
import { board, makeRound } from './helpers';
import * as C from '../src/constants';

const A = (r: number, c: number) => ({ r, c });

describe('зеро в рамке', () => {
  it('сумму не меняет: 1+9+0 = 10 — рамка валидна', () => {
    expect(isValidRect(board(['190']), normRect(A(0, 0), A(0, 2)))).toBe(true);
  });

  it('рамка из одних зеро (сумма 0) невалидна', () => {
    expect(isValidRect(board(['0']), normRect(A(0, 0), A(0, 0)))).toBe(false);
  });

  it('рамка с зеро: ×2 сразу и серия горит', () => {
    const out = playRect(makeRound(['190']), A(0, 0), A(0, 2), 1000);
    expect(out.zero).toBe(true);
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.popped).toHaveLength(3); // зеро лопается тоже
    expect(out.earnedCells).toBe(6);
    expect(isFireActive(out.round, 1000 + C.FIRE_WINDOW_MS - 1)).toBe(true);
  });

  it('зеро при горящей серии не стакается: потолок ×2', () => {
    const out = playRect(makeRound(['190'], { fireUntil: 50_000 }), A(0, 0), A(0, 2), 1000);
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.earnedCells).toBe(6);
  });
});

describe('зеро в генерации', () => {
  it('до 8-го уровня зеро нет, дальше — по лимиту', () => {
    for (let seed = 0; seed < 5; seed++) {
      expect(countZeros(generateBoard(seed, 0))).toBe(0);
      expect(countZeros(generateBoard(seed, 1))).toBeLessThanOrEqual(1);
    }
  });
});
