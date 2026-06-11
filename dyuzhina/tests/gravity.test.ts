import { describe, it, expect } from 'vitest';
import { applyPath, hasAnyUnitPath, createRng } from '../src/game';
import { board, fixedRng, T_ROWS } from './helpers';

const LAST = T_ROWS - 1;
const MAX9 = 9;

describe('applyPath: лопанье и гравитация', () => {
  it('лопает цепочку, столбец схлопывается вниз, сверху досыпается', () => {
    // колонка 0 сверху: 3,2,4, дальше девятки. Лопаем (1,0) и (2,0) — applyPath кратность не проверяет:
    const b = board(['371', '259', '4.8']);
    const result = applyPath(b, [{ r: 1, c: 0 }, { r: 2, c: 0 }], MAX9, fixedRng(0));
    expect(result.cleared).toBe(2);
    // выжившая тройка с (0,0) упала на (2,0)
    expect(result.board[2]![0]).toBe(3);
    // ниже — нетронутые девятки
    expect(result.board[3]![0]).toBe(9);
    expect(result.board[LAST]![0]).toBe(9);
    // сверху досыпались 2 новые (fixedRng(0) -> цифра 1)
    expect(result.board[0]![0]).toBe(1);
    expect(result.board[1]![0]).toBe(1);
    // колонка 2 без дырок — не тронута
    expect(result.board[0]![2]).toBe(1);
    expect(result.board[2]![2]).toBe(8);
  });

  it('пустых клеток после применения не остаётся', () => {
    const b = board(['19']);
    const result = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], MAX9, createRng(7));
    for (const row of result.board) for (const tile of row) expect(tile).not.toBeNull();
  });

  it('moves описывают падение выживших, spawns — новые клетки', () => {
    const b = board(['371', '259', '4.8']);
    const result = applyPath(b, [{ r: 1, c: 0 }, { r: 2, c: 0 }], MAX9, fixedRng(0));
    expect(result.moves).toContainEqual({ from: { r: 0, c: 0 }, to: { r: 2, c: 0 } });
    const spawnsCol0 = result.spawns.filter((s) => s.c === 0);
    expect(spawnsCol0).toHaveLength(2);
    expect(spawnsCol0.map((s) => s.r).sort()).toEqual([0, 1]);
  });

  it('ранее пустые клетки тоже засыпаются', () => {
    const b = board(['371', '259', '4.8']); // (2,1) пустая
    const result = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], MAX9, fixedRng(0));
    for (const row of result.board) for (const tile of row) expect(tile).not.toBeNull();
  });

  it('вход не мутируется', () => {
    const b = board(['19']);
    applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], MAX9, fixedRng(0));
    expect(b[0]![0]).toBe(1);
  });

  it('доска после досыпки всегда проходима (принудительная связка)', () => {
    // фон из семёрок, «злой» rng досыпает тоже семёрки -> 7k мимо 10/20 -> нужна связка 7+3
    const b = board(['19'], '7');
    const result = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], 7, fixedRng(0.9999));
    expect(hasAnyUnitPath(result.board)).toBe(true);
  });

  it('номинал досыпки не превышает maxTile', () => {
    const b = board(['19'], '5');
    const result = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], 5, fixedRng(0.9999));
    for (const row of result.board) for (const tile of row) expect(tile).toBeLessThanOrEqual(5);
  });

  it('детерминирован при одинаковом rng', () => {
    const b = board(['19']);
    const r1 = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], MAX9, createRng(3));
    const r2 = applyPath(b, [{ r: 0, c: 0 }, { r: 0, c: 1 }], MAX9, createRng(3));
    expect(r1.board).toEqual(r2.board);
  });
});
