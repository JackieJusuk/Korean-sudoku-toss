import { describe, expect, it } from 'vitest';
import { findConflicts, isBoardComplete, isBoardSolved } from '../validator';
import { EASY_PUZZLE, EASY_SOLUTION, cloneGrid } from './fixtures';

describe('findConflicts', () => {
  it('reports nothing for a valid partial or solved board', () => {
    expect(findConflicts(EASY_PUZZLE).size).toBe(0);
    expect(findConflicts(EASY_SOLUTION).size).toBe(0);
  });

  it('flags both cells of a row duplicate', () => {
    const grid = cloneGrid(EASY_PUZZLE);
    grid[0][2] = 5; // row 0 already has 5 at col 0
    const conflicts = findConflicts(grid);
    expect(conflicts.has('0,0')).toBe(true);
    expect(conflicts.has('0,2')).toBe(true);
  });

  it('flags a column duplicate', () => {
    const grid = cloneGrid(EASY_PUZZLE);
    grid[2][0] = 6; // col 0 already has 6 at row 1
    const conflicts = findConflicts(grid);
    expect(conflicts.has('1,0')).toBe(true);
    expect(conflicts.has('2,0')).toBe(true);
  });

  it('flags a box-only duplicate', () => {
    const grid = cloneGrid(EASY_PUZZLE);
    grid[2][0] = 3; // no 3 in row 2 or col 0, but top-left box has 3 at (0,1)
    const conflicts = findConflicts(grid);
    expect(conflicts).toEqual(new Set(['0,1', '2,0']));
  });
});

describe('isBoardSolved', () => {
  it('is true only for a complete, conflict-free board', () => {
    expect(isBoardSolved(EASY_SOLUTION)).toBe(true);
    expect(isBoardComplete(EASY_PUZZLE)).toBe(false);
    expect(isBoardSolved(EASY_PUZZLE)).toBe(false);

    const broken = cloneGrid(EASY_SOLUTION);
    [broken[0][0], broken[0][1]] = [broken[0][1], broken[0][0]];
    expect(isBoardComplete(broken)).toBe(true);
    expect(isBoardSolved(broken)).toBe(false);
  });
});
