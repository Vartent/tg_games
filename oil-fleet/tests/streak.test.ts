import { describe, it, expect } from 'vitest';
import { claimDailyStreak, utcDay, createInitialState } from '../src/engine';
import { EngineError } from '../src/types';
import { stateWithRigs } from './helpers';
import * as C from '../src/constants';

const DAY = 24 * 3600_000;

describe('utcDay', () => {
  it('форматирует UTC-день', () => {
    expect(utcDay(0)).toBe('1970-01-01');
    expect(utcDay(DAY + 1)).toBe('1970-01-02');
  });
});

describe('дейли-стрик', () => {
  it('первый клейм: стрик 1, подарок — вышка T1 на свободную ячейку', () => {
    const s1 = claimDailyStreak(createInitialState(0), 1000);
    expect(s1.streak.days).toBe(1);
    expect(s1.streak.lastClaimDay).toBe('1970-01-01');
    expect(s1.rigs).toHaveLength(1);
    expect(s1.rigs[0]!.tier).toBe(C.STREAK_REWARD_TIERS[0]);
  });

  it('повторный клейм в тот же день — ошибка', () => {
    const s1 = claimDailyStreak(createInitialState(0), 1000);
    expect(() => claimDailyStreak(s1, 2000)).toThrowError(
      new EngineError('ALREADY_CLAIMED_TODAY'),
    );
  });

  it('клейм на следующий день наращивает стрик, награды по таблице', () => {
    let s = createInitialState(0);
    for (let day = 0; day < 7; day++) {
      s = claimDailyStreak(s, day * DAY + 1000);
    }
    expect(s.streak.days).toBe(7);
    const tiers = s.rigs.map((r) => r.tier).sort((a, b) => a - b);
    expect(tiers).toEqual([...C.STREAK_REWARD_TIERS].sort((a, b) => a - b));
  });

  it('стрик дольше 7 дней даёт последнюю награду таблицы', () => {
    let s = createInitialState(0);
    for (let day = 0; day < 8; day++) s = claimDailyStreak(s, day * DAY + 1000);
    expect(s.streak.days).toBe(8);
    expect(s.rigs.filter((r) => r.tier === 4)).toHaveLength(2);
  });

  it('пропуск дня сбрасывает стрик на 1', () => {
    const s1 = claimDailyStreak(createInitialState(0), 1000);
    const s2 = claimDailyStreak(s1, 3 * DAY); // пропущен день 2
    expect(s2.streak.days).toBe(1);
  });

  it('нет места на сетке — подарок уходит в очередь', () => {
    const rigs = Array.from({ length: 12 }, (_, i) => ({ cell: i, tier: 5 }));
    const s0 = stateWithRigs(rigs);
    const s1 = claimDailyStreak(s0, 1000);
    expect(s1.rigs).toHaveLength(12);
    expect(s1.pendingGiftTiers).toEqual([C.STREAK_REWARD_TIERS[0]]);
  });
});
