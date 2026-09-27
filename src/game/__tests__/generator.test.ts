import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../generator';
import { estimateSearchSteps } from '../logicalSolver';
import { countSolutions } from '../sudokuCore';
import type { Difficulty } from '../types';
import { isBoardSolved } from '../validator';
import { cloneGrid } from './fixtures';

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

describe('generatePuzzle', () => {
  it.each(DIFFICULTIES)('%s: puzzle is a uniquely solvable subset of its solution', (difficulty) => {
    const { puzzle, solution, difficulty: reported } = generatePuzzle(difficulty);
    expect(reported).toBe(difficulty);
    expect(isBoardSolved(solution)).toBe(true);

    puzzle.forEach((row, r) =>
      row.forEach((value, c) => {
        if (value !== 0) expect(value).toBe(solution[r][c]);
      }),
    );
    expect(countSolutions(cloneGrid(puzzle))).toBe(1);
  });

  it('easy puzzles are solvable by singles alone', () => {
    for (let i = 0; i < 3; i++) {
      expect(estimateSearchSteps(generatePuzzle('easy').puzzle)).toBe(0);
    }
  }, 20_000);

  // Generation is randomized and falls back to the closest miss when no
  // candidate lands in the target band (~2% of hard puzzles end up solvable
  // by singles), so this checks the typical case rather than every puzzle.
  it('hard puzzles usually need guessing beyond singles', () => {
    const needsGuessing = Array.from({ length: 5 }, () => estimateSearchSteps(generatePuzzle('hard').puzzle) > 0);
    expect(needsGuessing.filter(Boolean).length).toBeGreaterThanOrEqual(3);
  }, 20_000);
});
