import type { Grid } from '../types';

export function parseGrid(rows: string[]): Grid {
  return rows.map((row) => [...row].map((ch) => (ch === '.' ? 0 : Number(ch))));
}

/** A well-known puzzle with a unique solution that falls to naked/hidden singles alone. */
export const EASY_PUZZLE = parseGrid([
  '53..7....',
  '6..195...',
  '.98....6.',
  '8...6...3',
  '4..8.3..1',
  '7...2...6',
  '.6....28.',
  '...419..5',
  '....8..79',
]);

export const EASY_SOLUTION = parseGrid([
  '534678912',
  '672195348',
  '198342567',
  '859761423',
  '426853791',
  '713924856',
  '961537284',
  '287419635',
  '345286179',
]);

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function countGivens(grid: Grid): number {
  return grid.flat().filter((value) => value !== 0).length;
}
