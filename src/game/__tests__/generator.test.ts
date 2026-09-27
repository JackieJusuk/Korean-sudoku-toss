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

  const STEP_BANDS: Record<Difficulty, [number, number]> = {
    easy: [0, 0],
    medium: [1, 500],
    hard: [501, Infinity],
  };

  it.each(DIFFICULTIES)('%s: puzzles land in their solving-difficulty band', (difficulty) => {
    const [min, max] = STEP_BANDS[difficulty];
    for (let i = 0; i < 3; i++) {
      const steps = estimateSearchSteps(generatePuzzle(difficulty).puzzle);
      expect(steps).toBeGreaterThanOrEqual(min);
      expect(steps).toBeLessThanOrEqual(max);
    }
  }, 20_000);
});
