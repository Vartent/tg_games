import { describe, it, expect } from 'vitest';
import { startDaily, startLevel, isWon, starsFor, countZeros } from '../src/game';
import * as C from '../src/constants';

describe('доска дня', () => {
  it('детерминирована по дате-seed: у всех одно поле', () => {
    expect(startDaily(20260612, 1000).board).toEqual(startDaily(20260612, 5000).board);
    expect(startDaily(20260612, 1000).board).not.toEqual(startDaily(20260613, 1000).board);
  });

  it('score-attack: без цели, не «выигрывается», 2 минуты', () => {
    const round = startDaily(20260612, 1000);
    expect(round.daily).toBe(true);
    expect(round.goal).toBe(0);
    expect(round.level).toBe(0);
    expect(round.endsAt).toBe(1000 + C.LEVEL_TIME_MS);
    expect(isWon(round)).toBe(false);
    expect(starsFor({ ...round, score: 50, cleared: 150 })).toBe(0);
  });

  it('на доске дня один зеро-лимит', () => {
    for (const seed of [20260612, 20260613, 20260614]) {
      expect(countZeros(startDaily(seed, 0).board)).toBeLessThanOrEqual(C.DAILY_ZEROS);
    }
  });

  it('доска дня отличается от доски уровня с тем же seed только параметрами раунда', () => {
    const daily = startDaily(42, 0);
    const level = startLevel(1, 42, 0);
    expect(daily.totalCells).toBe(level.totalCells);
  });
});
