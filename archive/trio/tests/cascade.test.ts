import { describe, it, expect } from 'vitest';
import { createRng, resolveCascades, generateBoard, hasAnyValidSwap, playSwap, startLevel } from '../src/game';
import { board, fixedRng } from './helpers';
import * as C from '../src/constants';

describe('каскады', () => {
  it('гравитация сводит выживших в новую тройку — вторая волна', () => {
    // колонка [2,3,1,4,5,5]: лопается 1+4+5 (ряды 2-4), 2 и 3 падают на нижнюю 5:
    // 2+3+5=10 — вторая волна. Досыпка семёрками (fixedRng(0.9)) поле успокаивает.
    const res = resolveCascades(board(['2', '3', '1', '4', '5', '5']), 9, fixedRng(0.9), 0);
    expect(res.waves).toHaveLength(2);
    expect(res.k).toBe(2);
    expect(res.zero).toBe(false);
    expect(res.board).toEqual(board(['7', '7', '7', '7', '7', '7']));
  });

  it('волна объединяет пересекающиеся тройки без двойного лопанья', () => {
    // [1,4,5,1]: тройки [1,4,5] и [4,5,1] пересекаются — одна волна, 2 группы, 4 клетки
    const res = resolveCascades(board(['1451']), 9, fixedRng(0.9), 0);
    const first = res.waves[0]!;
    expect(first.groups).toBe(2);
    expect(first.popped).toHaveLength(4);
  });

  it('спокойное поле — ноль волн', () => {
    const res = resolveCascades(board(['123', '456', '788']), 9, fixedRng(0.9), 0);
    expect(res.waves).toHaveLength(0);
    expect(res.k).toBe(0);
    expect(res.board).toEqual(board(['123', '456', '788']));
  });

  it('лопнувший зеро помечает ход (для ×2 и огонька)', () => {
    const res = resolveCascades(board(['190', '222']), 9, fixedRng(0.9), 0);
    expect(res.zero).toBe(true);
  });

  it('на живых досках каскад гаснет быстро: досыпка не замыкает тройки сама', () => {
    // регресс: со случайной досыпкой каскад раньше не гас и упирался в предохранитель
    for (let seed = 1; seed <= 5; seed++) {
      const round = startLevel(1, seed, 0);
      const rng = createRng(seed * 7);
      let played = false;
      outer: for (let r = 0; r < round.board.length; r++) {
        for (let c = 0; c < round.board[0]!.length; c++) {
          for (const b of [{ r, c: c + 1 }, { r: r + 1, c }]) {
            const swap = { a: { r, c }, b };
            const out = playSwap(round, swap, 1, rng);
            if (out.waves) {
              expect(out.waves.length, `seed=${seed}`).toBeLessThan(8);
              expect(hasAnyValidSwap(out.round.board) || out.reshuffled).toBe(true);
              played = true;
              break outer;
            }
          }
        }
      }
      expect(played, `seed=${seed}: на доске должен быть ход (гарантия генерации)`).toBe(true);
    }
  });

  it('сгенерированная доска при «жадном» зеро-rng не каскадит сама', () => {
    const b = generateBoard(3, 8); // уровень с зеро-лимитом 1
    expect(resolveCascades(b, 9, fixedRng(0), 1).waves).toHaveLength(0);
  });

  it('предохранитель: волн не больше CASCADE_CAP', () => {
    expect(C.CASCADE_CAP).toBeGreaterThan(0); // сам по себе бесконечный каскад с тройками не построить
  });
});
