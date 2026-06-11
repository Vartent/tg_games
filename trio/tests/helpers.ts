import type { Board } from '../src/types';

/** rng-заглушка: всегда одно значение. randomDigit(fixedRng(0.5), 9) даёт 4. */
export const fixedRng = (v = 0) => () => v;

/** Доска из строк цифр как есть (без дополнения); '.' = пустая. */
export function board(rowsSpec: string[]): Board {
  return rowsSpec.map((row) => row.split('').map((ch) => (ch === '.' ? null : Number(ch))));
}
