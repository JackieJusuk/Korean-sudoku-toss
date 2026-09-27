import { SIZE } from './constants';
import { estimateSearchSteps } from './logicalSolver';
import { applyRemovalOrder, digHolesOrdered, generateSolvedGrid } from './sudokuCore';
import type { Difficulty, Grid, SudokuPuzzle } from './types';

interface DifficultyProfile {
  minGivens: number;
  maxGivens: number;
  /** Fallback clue count if no candidate in range matches the step band. */
  seedGivens: number;
  /**
   * Inclusive band for `estimateSearchSteps`: how many trial-and-error
   * placements a backtracking solver needs once naked/hidden singles are
   * exhausted. 0 = solvable by pure logic; higher = more guessing/ambiguity.
   */
  stepRange: [number, number];
}

const PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: { minGivens: 32, maxGivens: 46, seedGivens: 36, stepRange: [0, 0] },
  medium: { minGivens: 22, maxGivens: 33, seedGivens: 28, stepRange: [1, 500] },
  hard: { minGivens: 19, maxGivens: 28, seedGivens: 24, stepRange: [501, Infinity] },
};

const TOTAL_CELLS = SIZE * SIZE;
/**
 * Roughly 40% of medium/hard digs never need guessing at any givens count,
 * so they can't produce an in-range candidate; generation therefore keeps
 * retrying with fresh solutions. A dig takes ~20-30ms on desktop, so the attempt cap and time
 * budget below keep a worst-case generation well under a second while making
 * a miss (falling back to the closest candidate) vanishingly rare.
 */
const MAX_DIG_ATTEMPTS = 20;
const TIME_BUDGET_MS = 600;

interface DigResult {
  puzzle: Grid;
  solution: Grid;
  /** True if `puzzle` actually landed inside the target's step range. */
  inRange: boolean;
  /** True if `puzzle` at least needs the same kind of solving as the target (guessing vs. pure logic). */
  matchesCharacter: boolean;
  distance: number;
}

/** Digs one removal path and returns every candidate puzzle worth keeping from it. */
function digOnce(solution: Grid, profile: DifficultyProfile): DigResult[] {
  const [minSteps, maxSteps] = profile.stepRange;
  const wantsGuessing = minSteps > 0;
  const order = digHolesOrdered(solution, profile.minGivens);

  const results: DigResult[] = [];
  for (let givens = profile.maxGivens; givens >= profile.minGivens; givens--) {
    const removeCount = TOTAL_CELLS - givens;
    if (removeCount > order.length) break; // fewer givens than this weren't achievable at all

    const puzzle = applyRemovalOrder(solution, order, removeCount);
    const steps = estimateSearchSteps(puzzle);
    const inRange = steps >= minSteps && steps <= maxSteps;
    const distance = steps < minSteps ? minSteps - steps : Math.max(0, steps - maxSteps);

    results.push({
      puzzle,
      solution,
      inRange,
      matchesCharacter: !wantsGuessing || steps > 0,
      distance,
    });
  }
  return results;
}

/**
 * Generates a puzzle for `difficulty`. Rather than trusting the clue count
 * alone, it digs a removal path down to this difficulty's lowest givens
 * count, then walks that path's givens counts and re-measures each
 * candidate's actual solving difficulty (`estimateSearchSteps`), picking one
 * whose step count lands in the target's range.
 *
 * A single dig often stays logically solvable all the way down (no candidate
 * ever needs guessing), which would misrepresent a "medium"/"hard" request
 * as trivial — so when no candidate lands in range, it retries with a fresh
 * solution and removal order (up to `MAX_DIG_ATTEMPTS` / `TIME_BUDGET_MS`)
 * before falling back to the closest miss that at least needs the same kind
 * of solving.
 */
export function generatePuzzle(difficulty: Difficulty): SudokuPuzzle {
  const profile = PROFILES[difficulty];
  const deadline = performance.now() + TIME_BUDGET_MS;

  let bestMatchingCharacter: DigResult | null = null;
  let bestAny: DigResult | null = null;

  for (let attempt = 0; attempt < MAX_DIG_ATTEMPTS; attempt++) {
    if (attempt > 0 && performance.now() > deadline) break;
    const results = digOnce(generateSolvedGrid(), profile);

    const inRange = results.filter((r) => r.inRange);
    if (inRange.length > 0) {
      const pick = inRange[Math.floor(Math.random() * inRange.length)];
      return { puzzle: pick.puzzle, solution: pick.solution, difficulty };
    }

    for (const result of results) {
      if (!bestAny || result.distance < bestAny.distance) bestAny = result;
      if (result.matchesCharacter && (!bestMatchingCharacter || result.distance < bestMatchingCharacter.distance)) {
        bestMatchingCharacter = result;
      }
    }
  }

  const best = bestMatchingCharacter ?? bestAny;
  if (best) return { puzzle: best.puzzle, solution: best.solution, difficulty };

  const solution = generateSolvedGrid();
  const puzzle = applyRemovalOrder(
    solution,
    digHolesOrdered(solution, profile.minGivens),
    TOTAL_CELLS - profile.seedGivens,
  );
  return { puzzle, solution, difficulty };
}
