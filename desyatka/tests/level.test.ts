import { describe, it, expect } from 'vitest';
import {
  startLevel, levelGoal, playRect, isRoundActive, isWon, isFireActive,
  clearedRatio, starsFor, continueRound, shareText,
} from '../src/game';
import { GameError } from '../src/types';
import { makeRound } from './helpers';
import * as C from '../src/constants';

const A = (r: number, c: number) => ({ r, c });

describe('раунд уровня', () => {
  it('startLevel: цель по уровню, 2 минуты, поле 17×10', () => {
    const round = startLevel(3, 42, 1000);
    expect(round.goal).toBe(levelGoal(3));
    expect(round.daily).toBe(false);
    expect(round.totalCells).toBe(C.ROWS * C.COLS);
    expect(round.endsAt).toBe(1000 + C.LEVEL_TIME_MS);
    expect(isRoundActive(round, 1000 + C.LEVEL_TIME_MS - 1)).toBe(true);
    expect(isRoundActive(round, 1000 + C.LEVEL_TIME_MS)).toBe(false);
  });

  it('валидная рамка: клетки лопаются, счёт и очистка растут', () => {
    const out = playRect(makeRound(['19', '23']), A(0, 0), A(0, 1), 1000);
    expect(out.popped).toHaveLength(2);
    expect(out.earnedCells).toBe(2);
    expect(out.round.score).toBe(2);
    expect(out.round.cleared).toBe(2);
    expect(out.round.board[0]).toEqual([null, null]);
  });

  it('большая рамка дороже: 1+1+5+3 = 10 — четыре клетки разом', () => {
    const out = playRect(makeRound(['11', '53']), A(0, 0), A(1, 1), 1000);
    expect(out.popped).toHaveLength(4);
    expect(out.earnedCells).toBe(4);
  });

  it('невалидная рамка — ничего: ни счёта, ни поля, ни штрафа', () => {
    const r0 = makeRound(['19', '23']);
    const out = playRect(r0, A(0, 0), A(1, 1), 1000); // 1+9+2+3=15
    expect(out.popped).toHaveLength(0);
    expect(out.round).toEqual(r0);
  });

  it('после endsAt рамки не принимаются', () => {
    expect(() => playRect(makeRound(['19']), A(0, 0), A(0, 1), 120_001)).toThrowError(
      new GameError('ROUND_OVER'),
    );
  });

  it('последний ход на поле -> over', () => {
    const out = playRect(makeRound(['19', '99']), A(0, 0), A(0, 1), 1000);
    expect(out.over).toBe(true); // остались только девятки
  });

  it('победа при score >= goal, дейли не выигрывается', () => {
    const round = makeRound(['19'], { goal: 2 });
    expect(isWon(round)).toBe(false);
    expect(isWon({ ...round, score: 2 })).toBe(true);
    expect(isWon({ ...round, score: 2, daily: true })).toBe(false);
  });
});

describe('серия (огонёк)', () => {
  it('вторая рамка внутри окна идёт ×2 и продлевает окно', () => {
    const r1 = playRect(makeRound(['19', '28']), A(0, 0), A(0, 1), 1000);
    expect(r1.multiplier).toBe(1);
    expect(isFireActive(r1.round, 1000 + C.FIRE_WINDOW_MS - 1)).toBe(true);
    const r2 = playRect(r1.round, A(1, 0), A(1, 1), 4000);
    expect(r2.multiplier).toBe(C.FIRE_MULT);
    expect(r2.earnedCells).toBe(4); // 2 клетки × 2
    expect(r2.round.score).toBe(6);
    expect(r2.round.fireUntil).toBe(4000 + C.FIRE_WINDOW_MS);
  });

  it('пауза дольше окна гасит серию', () => {
    const r1 = playRect(makeRound(['19', '28']), A(0, 0), A(0, 1), 1000);
    const r2 = playRect(r1.round, A(1, 0), A(1, 1), 1000 + C.FIRE_WINDOW_MS + 1);
    expect(r2.multiplier).toBe(1);
  });
});

describe('звёзды и очистка', () => {
  it('clearedRatio считает долю от стартовых клеток', () => {
    const out = playRect(makeRound(['19', '23']), A(0, 0), A(0, 1), 1000);
    expect(clearedRatio(out.round)).toBe(0.5);
  });

  it('звёзды: победа 1★, 55% очистки 2★, 80% 3★; поражение 0', () => {
    const base = makeRound(['19'], { goal: 1, totalCells: 100 });
    expect(starsFor({ ...base, score: 0, cleared: 90 })).toBe(0); // цель не взята
    expect(starsFor({ ...base, score: 1, cleared: 40 })).toBe(1);
    expect(starsFor({ ...base, score: 1, cleared: 55 })).toBe(2);
    expect(starsFor({ ...base, score: 1, cleared: 80 })).toBe(3);
    expect(starsFor({ ...base, score: 1, cleared: 100 })).toBe(3);
  });

  it('дейли звёзд не получает', () => {
    expect(starsFor(makeRound(['19'], { daily: true, score: 99, cleared: 2 }))).toBe(0);
  });
});

describe('выкуп продолжения', () => {
  it('после таймаута +30 сек, один раз', () => {
    const round = makeRound(['19']);
    expect(() => continueRound(round, 1000)).toThrowError(new GameError('ROUND_ACTIVE'));
    const cont = continueRound(round, 121_000);
    expect(cont.endsAt).toBe(121_000 + C.EXTENSION_MS);
    expect(() => continueRound(cont, 300_000)).toThrowError(new GameError('ALREADY_EXTENDED'));
  });
});

describe('шер-текст', () => {
  it('содержит уровень', () => {
    expect(shareText(7)).toContain('7');
  });
});
