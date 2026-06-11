import { describe, it, expect } from 'vitest';
import {
  playSwap, levelGoal, startLevel, isRoundActive, isWon, isFireActive, continueRound, shareText,
} from '../src/game';
import { GameError, type Round, type Swap } from '../src/types';
import { board, fixedRng } from './helpers';
import * as C from '../src/constants';

function makeRound(rows: string[], overrides: Partial<Round> = {}): Round {
  return {
    level: 9, // плато: номиналы до 9, зеро-лимит 1
    goal: levelGoal(9),
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

const swapRight = (r: number, c: number): Swap => ({ a: { r, c }, b: { r, c: c + 1 } });
const swapDown = (r: number, c: number): Swap => ({ a: { r, c }, b: { r: r + 1, c } });

describe('валидный свап', () => {
  it('лопает отрезок и начисляет зачёты', () => {
    // [[4,5],[5,6]] свап верхней пары -> col0: 5+5=10
    const out = playSwap(makeRound(['45', '56']), swapRight(0, 0), 1000, fixedRng(0.5));
    expect(out.waves).not.toBeNull();
    expect(out.k).toBeGreaterThanOrEqual(1);
    expect(out.earned).toBe(out.k * out.multiplier);
    expect(out.round.score).toBe(out.earned);
    expect(out.round.failStreak).toBe(0);
  });

  it('2+ отрезков за ход зажигают огонёк и дают +10с', () => {
    // колонка [0,5,3,5]: свап 3<->5 -> [0,5,5,3]: отрезки [0,5,5] и [5,5], зеро внутри
    const out = playSwap(makeRound(['0', '5', '3', '5']), swapDown(2, 0), 1000, fixedRng(0.5));
    expect(out.k).toBe(2);
    expect(out.zero).toBe(true);
    expect(out.multiplier).toBe(C.FIRE_MULT); // зеро даёт ×2 этому же ходу
    expect(out.earned).toBe(4);
    expect(out.round.fireUntil).toBe(1000 + C.FIRE_DURATION_MS);
    expect(out.round.endsAt).toBe(60_000 + C.MULTI_TIME_BONUS_MS);
    expect(isFireActive(out.round, 5000)).toBe(true);
  });

  it('после хода без оставшихся свапов поле перемешивается', () => {
    // после каскада останется [4,4,4,3] без ходов -> reshuffled
    const out = playSwap(makeRound(['0', '5', '3', '5']), swapDown(2, 0), 1000, fixedRng(0.5));
    expect(out.reshuffled).toBe(true);
    expect(out.round.board.length).toBeGreaterThan(4); // доска уровня 9, не колонка
  });

  it('при горящем огне одиночный отрезок идёт ×2, множители не стакаются', () => {
    const out = playSwap(
      makeRound(['45', '56'], { fireMult: C.FIRE_MULT, fireUntil: 50_000 }),
      swapRight(0, 0),
      1000,
      fixedRng(0.5),
    );
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.earned).toBe(out.k * C.FIRE_MULT);
  });
});

describe('невалидный свап — штраф с эскалацией', () => {
  const bad = swapRight(0, 0); // [[1,2],[3,4]] ничего не лопает

  it('подряд внутри окна: 1с, 2с', () => {
    const f1 = playSwap(makeRound(['12', '34']), bad, 1000, fixedRng(0.5));
    expect(f1.waves).toBeNull();
    expect(f1.penaltyMs).toBe(C.FAIL_PENALTY_MS);
    expect(f1.round.board).toEqual(board(['12', '34'])); // доска не меняется
    const f2 = playSwap(f1.round, bad, 1500, fixedRng(0.5));
    expect(f2.penaltyMs).toBe(2 * C.FAIL_PENALTY_MS);
    expect(f2.round.endsAt).toBe(60_000 - 3_000);
  });

  it('пауза дольше окна сбрасывает эскалацию', () => {
    const f1 = playSwap(makeRound(['12', '34']), bad, 1000, fixedRng(0.5));
    const f2 = playSwap(f1.round, bad, 1000 + C.FAIL_SPAM_WINDOW_MS + 1, fixedRng(0.5));
    expect(f2.penaltyMs).toBe(C.FAIL_PENALTY_MS);
  });

  it('после endsAt ходы не принимаются', () => {
    expect(() => playSwap(makeRound(['12', '34']), bad, 60_001, fixedRng(0.5))).toThrowError(
      new GameError('ROUND_OVER'),
    );
  });
});

describe('раунд уровня', () => {
  it('startLevel собирает раунд с доской уровня', () => {
    const round = startLevel(3, 42, 1000);
    expect(round.goal).toBe(levelGoal(3));
    expect(round.board).toHaveLength(9); // уровень 3: 6×9
    expect(round.board[0]).toHaveLength(6);
    expect(round.endsAt).toBe(1000 + 70_000); // levelTime(3) = 90с − 2×10с
    expect(isRoundActive(round, 70_999)).toBe(true);
    expect(isRoundActive(round, 71_000)).toBe(false);
  });

  it('победа при score >= goal', () => {
    const round = startLevel(1, 42, 0);
    expect(isWon(round)).toBe(false);
    expect(isWon({ ...round, score: round.goal })).toBe(true);
  });

  it('продолжение: один раз, после таймаута', () => {
    const round = startLevel(1, 1, 0);
    expect(() => continueRound(round, 1000)).toThrowError(new GameError('ROUND_ACTIVE'));
    const cont = continueRound(round, 90_001);
    expect(cont.endsAt).toBe(90_001 + C.EXTENSION_MS);
    expect(() => continueRound(cont, 200_000)).toThrowError(new GameError('ALREADY_EXTENDED'));
  });

  it('шер-текст содержит уровень и имя игры', () => {
    expect(shareText(7)).toContain('7');
    expect(shareText(7)).toContain('Трио');
  });
});
