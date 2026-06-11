import { describe, it, expect } from 'vitest';
import {
  playSwap, levelGoal, startLevel, isRoundActive, isWon, isFireActive, continueRound, shareText,
} from '../src/game';
import { GameError, type Round, type Swap } from '../src/types';
import { board, fixedRng } from './helpers';
import * as C from '../src/constants';

function makeRound(rows: string[], overrides: Partial<Round> = {}): Round {
  return {
    level: 1,
    goal: levelGoal(1),
    seed: 1,
    board: board(rows),
    score: 0,
    startedAt: 0,
    endsAt: 60_000,
    extended: false,
    fireMult: 1,
    fireUntil: 0,
    ...overrides,
  };
}

const swapRight = (r: number, c: number): Swap => ({ a: { r, c }, b: { r, c: c + 1 } });
const swapDown = (r: number, c: number): Swap => ({ a: { r, c }, b: { r: r + 1, c } });

describe('валидный свап', () => {
  // [[1,9],[4,8],[9,5]]: свап 9<->5 в нижнем ряду собирает col0 = 1+4+5
  const clean = ['19', '48', '95'];

  it('лопает тройку и начисляет зачёт', () => {
    const out = playSwap(makeRound(clean), { a: { r: 2, c: 0 }, b: { r: 2, c: 1 } }, 1000, fixedRng(0.9));
    expect(out.waves).not.toBeNull();
    expect(out.k).toBe(1);
    expect(out.multiplier).toBe(1);
    expect(out.earned).toBe(1);
    expect(out.round.score).toBe(1);
    expect(out.round.endsAt).toBe(60_000); // одиночная тройка время не добавляет
    expect(isFireActive(out.round, 1001)).toBe(false);
  });

  it('каскад на 2 тройки: огонёк и +10с', () => {
    // колонка [2,4,3,5,1,5]: свап 4<->3 -> [2,3,4,5,1,5]: лопается 4+5+1 (ряды 2-4),
    // 2 и 3 падают на нижнюю 5 -> 2+3+5 — вторая волна
    const out = playSwap(makeRound(['2', '4', '3', '5', '1', '5']), swapDown(1, 0), 1000, fixedRng(0.9));
    expect(out.k).toBe(2);
    expect(out.earned).toBe(2);
    expect(out.round.endsAt).toBe(60_000 + C.MULTI_TIME_BONUS_MS);
    expect(out.round.fireUntil).toBe(1000 + C.FIRE_DURATION_MS);
    expect(isFireActive(out.round, 5000)).toBe(true);
  });

  it('тройка с зеро: ×2 этому же ходу и огонёк', () => {
    // [[0,2],[1,8],[7,9]]: свап 7<->9 -> col0 = 0+1+9 = 10, с зеро
    const out = playSwap(makeRound(['02', '18', '79']), swapRight(2, 0), 1000, fixedRng(0.9));
    expect(out.k).toBe(1);
    expect(out.zero).toBe(true);
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.earned).toBe(2);
    expect(out.round.fireUntil).toBe(1000 + C.FIRE_DURATION_MS);
  });

  it('при горящем огне множители не стакаются: потолок ×2', () => {
    const out = playSwap(
      makeRound(['02', '18', '79'], { fireMult: C.FIRE_MULT, fireUntil: 50_000 }),
      swapRight(2, 0),
      1000,
      fixedRng(0.9),
    );
    expect(out.multiplier).toBe(C.FIRE_MULT);
    expect(out.earned).toBe(out.k * C.FIRE_MULT);
  });

  it('если после хода нет свапов — поле перемешивается в доску уровня', () => {
    // после каскада останется колонка семёрок без ходов -> reshuffle
    const out = playSwap(makeRound(['2', '4', '3', '5', '1', '5']), swapDown(1, 0), 1000, fixedRng(0.9));
    expect(out.reshuffled).toBe(true);
    expect(out.round.board[0]!.length).toBe(5); // 5 колонок уровня 1
  });
});

describe('невалидный свап — без последствий', () => {
  const bad = swapRight(0, 0); // [[1,2],[3,4]]: окон из трёх нет вообще

  it('раунд не меняется: ни доска, ни счёт, ни время', () => {
    const r0 = makeRound(['12', '34']);
    const out = playSwap(r0, bad, 1000, fixedRng(0.9));
    expect(out.waves).toBeNull();
    expect(out.earned).toBe(0);
    expect(out.round).toEqual(r0);
  });

  it('после endsAt ходы не принимаются', () => {
    expect(() => playSwap(makeRound(['12', '34']), bad, 60_001, fixedRng(0.9))).toThrowError(
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
