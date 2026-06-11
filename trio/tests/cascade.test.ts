import { describe, it, expect } from 'vitest';
import { createRng, resolveCascades, generateBoard, hasAnyValidSwap, playSwap, startLevel } from '../src/game';
import { board, fixedRng } from './helpers';
import * as C from '../src/constants';

describe('каскады', () => {
  it('гравитация сводит 2 и 8 — вторая волна; досыпка четвёрками успокаивает поле', () => {
    // колонка [2,1,9,8]: лопается 1+9, двойка падает на восьмёрку -> 2+8=10,
    // плюс досыпанные 4+4+2=10 — вторая волна на два отрезка; финал [4,4,4,4].
    const res = resolveCascades(board(['2', '1', '9', '8']), 9, fixedRng(0.5), 0);
    expect(res.waves).toHaveLength(2);
    expect(res.k).toBe(3); // 1 отрезок в первой волне + 2 во второй
    expect(res.zero).toBe(false);
    expect(res.board).toEqual(board(['4', '4', '4', '4']));
  });

  it('волна объединяет пересекающиеся отрезки без двойного лопанья', () => {
    // [5,5,5]: 5+5 дважды (пересекаются в средней) — одна волна, 2 отрезка, 3 клетки
    const res = resolveCascades(board(['555']), 9, fixedRng(0.5), 0);
    const first = res.waves[0]!;
    expect(first.groups).toBe(2);
    expect(first.popped).toHaveLength(3);
  });

  it('бесконечный каскад срезается предохранителем CASCADE_CAP', () => {
    // спавнятся одни пятёрки -> 5+5 лопается вечно
    const res = resolveCascades(board(['5', '5']), 9, fixedRng(0.7), 0);
    expect(res.waves).toHaveLength(C.CASCADE_CAP);
  });

  it('спокойное поле — ноль волн', () => {
    const res = resolveCascades(board(['12', '34']), 9, fixedRng(0.5), 0);
    expect(res.waves).toHaveLength(0);
    expect(res.k).toBe(0);
    expect(res.board).toEqual(board(['12', '34']));
  });

  it('лопнувший зеро помечает ход (для ×2 и огонька)', () => {
    // [1,9,0] лопается двумя отрезками, зеро внутри
    const res = resolveCascades(board(['190', '234']), 9, fixedRng(0.5), 0);
    expect(res.zero).toBe(true);
  });

  it('на живых досках каскад гаснет: досыпка не замыкает десятки сама', () => {
    // регресс: со случайной досыпкой каскад раньше не гас и упирался в предохранитель
    for (let seed = 1; seed <= 5; seed++) {
      const round = startLevel(1, seed, 0);
      const rng = createRng(seed * 7);
      // ищем валидный свап и играем его
      let played = false;
      outer: for (let r = 0; r < round.board.length; r++) {
        for (let c = 0; c < round.board[0]!.length; c++) {
          for (const b of [{ r, c: c + 1 }, { r: r + 1, c }]) {
            const swap = { a: { r, c }, b };
            try {
              const out = playSwap(round, swap, 1, rng);
              if (out.waves) {
                expect(out.waves.length, `seed=${seed}`).toBeLessThan(C.CASCADE_CAP / 2);
                expect(hasAnyValidSwap(out.round.board) || out.reshuffled).toBe(true);
                played = true;
                break outer;
              }
            } catch {
              /* ROUND_OVER не ожидается */
            }
          }
        }
      }
      expect(played, `seed=${seed}: на доске должен быть ход (гарантия генерации)`).toBe(true);
    }
  });

  it('сгенерированная доска при «жадном» зеро-rng не получает лишних зеро в досыпку', () => {
    const b = generateBoard(3, 8); // уровень с зеро-лимитом 1
    expect(resolveCascades(b, 9, fixedRng(0), 1).waves).toHaveLength(0); // без групп — без волн
  });
});
