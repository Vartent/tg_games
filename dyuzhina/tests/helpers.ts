import type { Board } from '../src/types';

/** Размер тестовой доски (соответствует плато уровней: 9×12). */
export const T_COLS = 9;
export const T_ROWS = 12;

/** rng-заглушка: всегда одно значение. fixedRng(0) даёт цифру 1, fixedRng(0.9999) — максимальную. */
export const fixedRng = (v = 0) => () => v;

/** Доска из строк цифр; '.' = пустая. Дополняется девятками до T_ROWS×T_COLS.
 *  Девятки — «нейтральный» фон: для Σ10 пара 9+9=18 не собирается сама собой. */
export function board(rowsSpec: string[], filler = '9'): Board {
  const grid: Board = rowsSpec.map((row) =>
    row.split('').map((ch) => (ch === '.' ? null : Number(ch))),
  );
  while (grid.length < T_ROWS) grid.push(filler.repeat(T_COLS).split('').map(Number));
  return grid.map((row) => {
    const r = [...row];
    while (r.length < T_COLS) r.push(Number(filler));
    return r;
  });
}
