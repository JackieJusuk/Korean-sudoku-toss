import { describe, expect, it } from 'vitest';
import {
  applyRemovalOrder,
  countSolutions,
  createEmptyGrid,
  digHolesOrdered,
  generateSolvedGrid,
  solveGrid,
} from '../sudokuCore';
import { isBoardSolved } from '../validator';
import { EASY_PUZZLE, EASY_SOLUTION, cloneGrid, countGivens } from './fixtures';

describe('solveGrid', () => {
  it('solves a known puzzle to its unique solution', () => {
    const grid = cloneGrid(EASY_PUZZLE);
    expect(solveGrid(grid)).toBe(true);
    expect(grid).toEqual(EASY_SOLUTION);
  });
});

describe('generateSolvedGrid', () => {
  it('produces a complete valid board', () => {
    for (let i = 0; i < 5; i++) expect(isBoardSolved(generateSolvedGrid())).toBe(true);
  });
});

describe('countSolutions', () => {
  it('counts 1 for a unique puzzle and does not mutate it', () => {
    const grid = cloneGrid(EASY_PUZZLE);
    expect(countSolutions(grid)).toBe(1);
    expect(grid).toEqual(EASY_PUZZLE);
  });

  it('stops at the limit for an ambiguous grid', () => {
    expect(countSolutions(createEmptyGrid(), 2)).toBe(2);
  });

  it('returns limit + 1 when the node budget runs out', () => {
    expect(countSolutions(createEmptyGrid(), 2, 5)).toBe(3);
  });
});

describe('digHolesOrdered / applyRemovalOrder', () => {
  it('keeps every prefix of the removal order uniquely solvable', () => {
    const solution = generateSolvedGrid();
    const order = digHolesOrdered(solution, 30);
    expect(countGivens(applyRemovalOrder(solution, order, order.length))).toBeGreaterThanOrEqual(30);

    for (const removeCount of [0, 10, Math.floor(order.length / 2), order.length]) {
      const puzzle = applyRemovalOrder(solution, order, removeCount);
      expect(countGivens(puzzle)).toBe(81 - removeCount);
      expect(countSolutions(cloneGrid(puzzle))).toBe(1);
    }
  });

  it('does not mutate the solved grid', () => {
    const solution = generateSolvedGrid();
    const snapshot = cloneGrid(solution);
    applyRemovalOrder(solution, digHolesOrdered(solution, 40), 20);
    expect(solution).toEqual(snapshot);
  });
});
