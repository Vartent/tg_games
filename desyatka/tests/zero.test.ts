import { describe, it, expect } from 'vitest';
import {
  maxZeros, countZeros, generateBoard, applyPath, playPath, isValidPath, isFireActive, levelGoal,
} from '../src/game';
import { board, fixedRng } from './helpers';
import * as C from '../src/constants';
import type { Path, Round } from '../src/types';

function makeRound(rows: string[], overrides: Partial<Round> = {}): Round {
  return {
    level: 8,
    goal: levelGoal(8),
    seed: 1,
    board: board(rows),
    score: 0,
    startedAt: 0,
    endsAt: 60_000,
    extended: false,
    fireMult: 1,
    fireUntil: 0,
    failStreak: 0,
    lastFailAt: 0,
    ...overrides,
  };
}

const rowPath = (n: number): Path => Array.from({ length: n }, (_, c) => ({ r: 0, c }));

describe('лимит зеро по уровню', () => {
  it('до ZERO_START_LEVEL зеро нет', () => {
    expect(maxZeros(1)).toBe(0);
    expect(maxZeros(7)).toBe(0);
  });

  it('с 8-го уровня — один, с 20-го — два, дальше +1 каждые 12', () => {
    expect(maxZeros(8)).toBe(1);
    expect(maxZeros(19)).toBe(1);
    expect(maxZeros(20)).toBe(2);
    expect(maxZeros(31)).toBe(2);
    expect(maxZeros(32)).toBe(3);
  });
});

describe('генерация с зеро', () => {
  it('до 8-го уровня зеро не генерится', () => {
    for (let seed = 0; seed < 15; seed++) {
      expect(countZeros(generateBoard(seed, 7))).toBe(0);
    }
  });

  it('на 8-м уровне — не больше одного зеро', () => {
    for (let seed = 0; seed < 15; seed++) {
      expect(countZeros(generateBoard(seed, 8))).toBeLessThanOrEqual(1);
    }
  });

  it('на 20-м уровне — не больше двух', () => {
    for (let seed = 0; seed < 15; seed++) {
      expect(countZeros(generateBoard(seed, 20))).toBeLessThanOrEqual(2);
    }
  });
});

describe('досыпка с зеро', () => {
  it('выживший зеро занимает лимит — новый не приходит', () => {
    // зеро в (1,1) не лопается; rng всегда хочет зеро, но лимит 1 уже занят
    const b = board(['19', '90']);
    const res = applyPath(b, rowPath(2), 9, fixedRng(0), 1);
    expect(countZeros(res.board)).toBe(1);
  });

  it('лопнули зеро — на его место может прийти новый (в пределах лимита)', () => {
    // зеро в (0,1) лопается; rng всегда хочет зеро -> ровно один новый
    const b = board(['10']);
    const res = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], 9, fixedRng(0), 1);
    expect(countZeros(res.board)).toBe(1);
  });

  it('при zeroCap=0 зеро не приходят даже при «жадном» rng', () => {
    const res = applyPath(board(['19']), rowPath(2), 9, fixedRng(0), 0);
    expect(countZeros(res.board)).toBe(0);
  });
});

describe('зеро в цепочке', () => {
  it('сумма с зеро не меняется: 1+9+0 = 10 — валидная цепь', () => {
    expect(isValidPath(board(['190']), rowPath(3))).toBe(true);
  });

  it('зеро сам по себе не цепь (сумма 0)', () => {
    expect(isValidPath(board(['0']), [{ r: 0, c: 0 }])).toBe(false);
  });

  it('цепь с зеро: ×2 сразу к этой цепи и огонёк горит', () => {
    const out = playPath(makeRound(['190']), rowPath(3), 1000, fixedRng(0.5));
    expect(out.k).toBe(1);
    expect(out.zero).toBe(true);
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.earned).toBe(2);
    expect(out.round.fireUntil).toBe(1000 + C.FIRE_DURATION_MS);
    expect(isFireActive(out.round, 1000 + C.FIRE_DURATION_MS - 1)).toBe(true);
  });

  it('одиночная цепь с зеро время не добавляет (бонус только за двойную)', () => {
    const out = playPath(makeRound(['190']), rowPath(3), 1000, fixedRng(0.5));
    expect(out.round.endsAt).toBe(60_000);
  });

  it('зеро при горящем огне не стакается: множитель остаётся ×2', () => {
    const out = playPath(
      makeRound(['190'], { fireMult: C.FIRE_MULT, fireUntil: 50_000 }),
      rowPath(3),
      1000,
      fixedRng(0.5),
    );
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.earned).toBe(2);
  });

  it('двойная цепь с зеро: 2 зачёта × 2 и +10с', () => {
    // 1+9+0+9+1 = 20
    const out = playPath(makeRound(['19091']), rowPath(5), 1000, fixedRng(0.5));
    expect(out.k).toBe(2);
    expect(out.earned).toBe(4);
    expect(out.round.endsAt).toBe(60_000 + C.CHAIN_TIME_BONUS_MS);
  });
});
