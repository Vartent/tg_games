import { describe, it, expect } from 'vitest';
import {
  levelGoal, levelTime, startLevel, isRoundActive, isWon, playPath, continueRound,
  isFireActive, shareText,
} from '../src/game';
import { GameError, type Path, type Round } from '../src/types';
import { board, fixedRng } from './helpers';
import * as C from '../src/constants';

/** Раунд с подкрученной доской — для проверки начислений и огонька. */
function makeRound(rows: string[], overrides: Partial<Round> = {}): Round {
  return {
    level: 5,
    goal: levelGoal(5),
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

/** Путь по первым n клеткам верхнего ряда. */
const rowPath = (n: number): Path => Array.from({ length: n }, (_, c) => ({ r: 0, c }));

describe('параметры уровней', () => {
  it('уровень 1 — обучение: 10 зачётов (100 очков), 90с', () => {
    expect(levelGoal(1)).toBe(10);
    expect(levelTime(1)).toBe(90_000);
  });

  it('сложность растёт: +5 зачётов (50 очков) и -10с за уровень', () => {
    expect(levelGoal(2)).toBe(15);
    expect(levelGoal(3)).toBe(20);
    expect(levelTime(2)).toBe(80_000);
    expect(levelTime(4)).toBe(60_000);
  });

  it('плато: цель и время упираются в капы', () => {
    expect(levelGoal(9)).toBe(C.MAX_GOAL);
    expect(levelGoal(50)).toBe(C.MAX_GOAL);
    expect(levelTime(50)).toBe(C.MIN_TIME_MS);
  });
});

describe('раунд уровня', () => {
  it('startLevel собирает раунд: цель в зачётах, таймер и поле уровня, огонёк потушен', () => {
    const round = startLevel(3, 42, 1000);
    expect(round.level).toBe(3);
    expect(round.goal).toBe(levelGoal(3));
    expect(round.score).toBe(0);
    expect(round.endsAt).toBe(1000 + levelTime(3));
    expect(round.fireMult).toBe(1);
    expect(isFireActive(round, 1000)).toBe(false);
    expect(round.board).toHaveLength(4); // уровень 3 — вторая ступень размера: 4×4
    expect(round.board[0]).toHaveLength(4);
  });

  it('активен строго до endsAt', () => {
    const round = startLevel(1, 1, 0);
    expect(isRoundActive(round, levelTime(1) - 1)).toBe(true);
    expect(isRoundActive(round, levelTime(1))).toBe(false);
  });

  it('один зачёт (ровно 10): +1 к счёту', () => {
    const out = playPath(makeRound(['19']), rowPath(2), 1000, fixedRng(0));
    expect(out.k).toBe(1);
    expect(out.earned).toBe(1);
    expect(out.round.score).toBe(1);
  });

  it('цепочка на 20 — два зачёта с одной цепи, +5с к таймеру', () => {
    const out = playPath(makeRound(['9191']), rowPath(4), 1000, fixedRng(0));
    expect(out.k).toBe(2);
    expect(out.earned).toBe(2); // множитель применяется только к следующим цепочкам
    expect(out.round.fireMult).toBe(2);
    expect(out.round.endsAt).toBe(60_000 + C.CHAIN_TIME_BONUS_MS);
  });

  it('цепь на 30 невалидна — больше двух зачётов не собрать (и штрафуется как промах)', () => {
    const round = makeRound(['919191']);
    const out = playPath(round, rowPath(6), 1000, fixedRng(0));
    expect(out.earned).toBe(0);
    expect(out.result).toBeNull();
    expect(out.round.board).toEqual(round.board);
    expect(out.round.score).toBe(0);
    expect(out.penaltyMs).toBe(C.FAIL_PENALTY_MS);
  });

  it('одиночный зачёт время не добавляет', () => {
    const out = playPath(makeRound(['19']), rowPath(2), 1000, fixedRng(0));
    expect(out.round.endsAt).toBe(60_000);
  });

  it('невалидная цепочка: доска и счёт не меняются, но снимается секунда', () => {
    const round = makeRound(['19']);
    const out = playPath(round, rowPath(3), 1000, fixedRng(0)); // 1+9+9=19
    expect(out.earned).toBe(0);
    expect(out.result).toBeNull();
    expect(out.round.board).toEqual(round.board);
    expect(out.round.score).toBe(0);
    expect(out.penaltyMs).toBe(C.FAIL_PENALTY_MS);
    expect(out.round.endsAt).toBe(60_000 - C.FAIL_PENALTY_MS);
  });

  it('после endsAt цепочки не принимаются', () => {
    expect(() => playPath(makeRound(['19']), rowPath(2), 60_001, fixedRng(0))).toThrowError(
      new GameError('ROUND_OVER'),
    );
  });

  it('победа при score >= goal (в зачётах)', () => {
    const round = startLevel(1, 42, 0);
    expect(isWon(round)).toBe(false);
    expect(isWon({ ...round, score: round.goal })).toBe(true);
  });
});

describe('огонёк (тайм-буст за двойные цепочки)', () => {
  it('мульти-цепь зажигает огонь ×k на FIRE_DURATION_MS', () => {
    const out = playPath(makeRound(['9191']), rowPath(4), 1000, fixedRng(0));
    expect(out.round.fireMult).toBe(2);
    expect(out.round.fireUntil).toBe(1000 + C.FIRE_DURATION_MS);
    expect(isFireActive(out.round, 1000 + C.FIRE_DURATION_MS - 1)).toBe(true);
    expect(isFireActive(out.round, 1000 + C.FIRE_DURATION_MS)).toBe(false);
  });

  it('пока огонь горит, любая цепочка идёт с множителем — и одиночный зачёт тоже', () => {
    const lit = playPath(makeRound(['9191']), rowPath(4), 1000, fixedRng(0));
    const single = playPath({ ...lit.round, board: board(['19']) }, rowPath(2), 5000, fixedRng(0));
    expect(single.k).toBe(1);
    expect(single.multiplier).toBe(2);
    expect(single.earned).toBe(2);
    // одиночная не перезапускает таймер и не гасит
    expect(single.round.fireUntil).toBe(lit.round.fireUntil);
    expect(single.round.fireMult).toBe(2);
  });

  it('мульти-цепь в окне: начисление с огнём и перезапуск таймера', () => {
    const lit = playPath(makeRound(['9191']), rowPath(4), 1000, fixedRng(0));
    const second = playPath({ ...lit.round, board: board(['9191']) }, rowPath(4), 6000, fixedRng(0));
    expect(second.earned).toBe(4); // 2 зачёта × огонь ×2
    expect(second.round.fireUntil).toBe(6000 + C.FIRE_DURATION_MS);
  });

  it('после истечения окна множитель пропадает, мульти-цепь зажигает заново', () => {
    const lit = playPath(makeRound(['9191']), rowPath(4), 1000, fixedRng(0));
    const late = playPath(
      { ...lit.round, board: board(['9191']) },
      rowPath(4),
      1000 + C.FIRE_DURATION_MS + 1,
      fixedRng(0),
    );
    expect(late.multiplier).toBe(1);
    expect(late.earned).toBe(2);
    expect(late.round.fireUntil).toBe(1000 + C.FIRE_DURATION_MS + 1 + C.FIRE_DURATION_MS);
  });

  it('множитель огня не превышает ×2 (FIRE_MULT — потолок)', () => {
    const lit = playPath(makeRound(['9191']), rowPath(4), 1000, fixedRng(0));
    expect(lit.round.fireMult).toBe(C.FIRE_MULT);
    const second = playPath({ ...lit.round, board: board(['9191']) }, rowPath(4), 5000, fixedRng(0));
    expect(second.multiplier).toBe(2);
    expect(second.earned).toBe(4); // максимум за ход: 2 дюжины × огонь ×2
  });
});

describe('штраф за спам неудачных попыток', () => {
  const bad = rowPath(3); // 1+9+9 = 19 — невалидно

  it('подряд внутри окна: 1с, 2с, 3с', () => {
    const r0 = makeRound(['19']);
    const f1 = playPath(r0, bad, 1000, fixedRng(0));
    const f2 = playPath(f1.round, bad, 1500, fixedRng(0));
    const f3 = playPath(f2.round, bad, 2200, fixedRng(0));
    expect(f1.penaltyMs).toBe(1_000);
    expect(f2.penaltyMs).toBe(2_000);
    expect(f3.penaltyMs).toBe(3_000);
    expect(f3.round.endsAt).toBe(60_000 - 6_000);
  });

  it('пауза дольше окна сбрасывает эскалацию', () => {
    const f1 = playPath(makeRound(['19']), bad, 1000, fixedRng(0));
    const f2 = playPath(f1.round, bad, 1000 + C.FAIL_SPAM_WINDOW_MS + 1, fixedRng(0));
    expect(f2.penaltyMs).toBe(C.FAIL_PENALTY_MS);
  });

  it('валидная цепь сбрасывает эскалацию', () => {
    const f1 = playPath(makeRound(['19']), bad, 1000, fixedRng(0));
    const ok = playPath({ ...f1.round, board: board(['19']) }, rowPath(2), 1500, fixedRng(0));
    expect(ok.round.failStreak).toBe(0);
    const f2 = playPath({ ...ok.round, board: board(['19']) }, bad, 1600, fixedRng(0));
    expect(f2.penaltyMs).toBe(C.FAIL_PENALTY_MS);
  });

  it('штраф может закончить раунд (endsAt уходит в прошлое)', () => {
    const r0 = makeRound(['19'], { endsAt: 1500 });
    const f1 = playPath(r0, bad, 1000, fixedRng(0));
    expect(f1.round.endsAt).toBe(500);
    expect(() => playPath(f1.round, bad, 1100, fixedRng(0))).toThrowError(
      new GameError('ROUND_OVER'),
    );
  });
});

describe('выкуп продолжения после таймаута', () => {
  const T = levelTime(1);

  it('после таймаута даёт ещё EXTENSION_MS от текущего момента', () => {
    const round = startLevel(1, 1, 0);
    const cont = continueRound(round, T + 5_000);
    expect(cont.endsAt).toBe(T + 5_000 + C.EXTENSION_MS);
    expect(cont.extended).toBe(true);
    expect(isRoundActive(cont, T + 6_000)).toBe(true);
  });

  it('счёт и доска при продолжении сохраняются', () => {
    const round = { ...startLevel(1, 42, 0), score: 15 };
    const cont = continueRound(round, T + 1);
    expect(cont.score).toBe(15);
    expect(cont.board).toEqual(round.board);
  });

  it('в активном раунде продолжение невозможно', () => {
    expect(() => continueRound(startLevel(1, 1, 0), 1_000)).toThrowError(
      new GameError('ROUND_ACTIVE'),
    );
  });

  it('второй выкуп за раунд — ошибка', () => {
    const cont = continueRound(startLevel(1, 1, 0), T + 1);
    expect(() => continueRound(cont, T + C.EXTENSION_MS + 5_000)).toThrowError(
      new GameError('ALREADY_EXTENDED'),
    );
  });
});

describe('шер-текст', () => {
  it('содержит уровень', () => {
    expect(shareText(7)).toContain('7');
  });
});
