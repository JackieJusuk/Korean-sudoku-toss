import { describe, expect, it } from 'vitest';
import { estimateSearchSteps, logicalSolveGap } from '../logicalSolver';
import { EASY_PUZZLE, EASY_SOLUTION, cloneGrid } from './fixtures';

describe('logicalSolver', () => {
  it('solves a singles-only puzzle without guessing', () => {
    expect(logicalSolveGap(EASY_PUZZLE)).toBe(0);
    expect(estimateSearchSteps(EASY_PUZZLE)).toBe(0);
  });

  it('needs no steps for an already solved grid', () => {
    expect(estimateSearchSteps(EASY_SOLUTION)).toBe(0);
  });

  it('does not mutate its input', () => {
    const grid = cloneGrid(EASY_PUZZLE);
    estimateSearchSteps(grid);
    logicalSolveGap(grid);
    expect(grid).toEqual(EASY_PUZZLE);
  });

  it('respects the step cap', () => {
    const empty = Array.from({ length: 9 }, () => Array(9).fill(0));
    // An empty grid defeats singles entirely, so the backtracker has to run.
    expect(logicalSolveGap(empty)).toBe(81);
    expect(estimateSearchSteps(empty, 10)).toBeLessThanOrEqual(10);
  });
});
