import { BOX_SIZE, DIGITS, SIZE } from './constants';
import { logicalSolveGap } from './logicalSolver';
import type { Grid } from './types';

export function createEmptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function canPlace(grid: Grid, row: number, col: number, value: number): boolean {
  for (let i = 0; i < SIZE; i++) {
    if (grid[row][i] === value || grid[i][col] === value) return false;
  }
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) {
      if (grid[r][c] === value) return false;
    }
  }
  return true;
}

function findEmptyCell(grid: Grid): [number, number] | null {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Fills `grid` in place via randomized backtracking. Returns false if unsolvable. */
export function solveGrid(grid: Grid, randomize = false): boolean {
  const empty = findEmptyCell(grid);
  if (!empty) return true;
  const [row, col] = empty;
  const candidates = randomize ? shuffled(DIGITS) : DIGITS;
  for (const value of candidates) {
    if (canPlace(grid, row, col, value)) {
      grid[row][col] = value;
      if (solveGrid(grid, randomize)) return true;
      grid[row][col] = 0;
    }
  }
  return false;
}

export function generateSolvedGrid(): Grid {
  const grid = createEmptyGrid();
  solveGrid(grid, true);
  return grid;
}

const ALL_CANDIDATES = 0b11_1111_1110; // bits 1-9

function popcount(mask: number): number {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count++;
  return count;
}

/**
 * Counts solutions up to `limit`, stopping early once reached (used for
 * uniqueness checks). Branches on the empty cell with the fewest legal
 * candidates ("minimum remaining values" heuristic) — instead of the first
 * empty cell — which keeps the search from blowing up on sparse grids, and
 * tracks used digits per row/column/box as bitmasks so each step is cheap.
 * A hard node budget means a single check can never hang: if the budget is
 * exhausted, returns `limit + 1` (a value that can never equal a real
 * solution count) so callers treat it as "not verified unique" rather than
 * risking a false positive. `grid` is restored before returning.
 */
export function countSolutions(grid: Grid, limit = 2, nodeBudget = 20000): number {
  const rowUsed = new Array<number>(SIZE).fill(0);
  const colUsed = new Array<number>(SIZE).fill(0);
  const boxUsed = new Array<number>(SIZE).fill(0);
  const boxOf = (row: number, col: number) => Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(col / BOX_SIZE);

  const empties: number[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c];
      if (value === 0) {
        empties.push(r * SIZE + c);
      } else {
        rowUsed[r] |= 1 << value;
        colUsed[c] |= 1 << value;
        boxUsed[boxOf(r, c)] |= 1 << value;
      }
    }
  }

  let nodes = 0;
  let budgetExceeded = false;

  function search(remainingLimit: number): number {
    if (budgetExceeded) return 0;
    if (++nodes > nodeBudget) {
      budgetExceeded = true;
      return 0;
    }

    let bestPos = -1;
    let bestMask = 0;
    let bestCount = SIZE + 1;
    for (const pos of empties) {
      const r = Math.floor(pos / SIZE);
      const c = pos % SIZE;
      if (grid[r][c] !== 0) continue;
      const mask = ALL_CANDIDATES & ~(rowUsed[r] | colUsed[c] | boxUsed[boxOf(r, c)]);
      const count = popcount(mask);
      if (count < bestCount) {
        bestPos = pos;
        bestMask = mask;
        bestCount = count;
        if (count <= 1) break; // can't do better than a forced/dead cell
      }
    }
    if (bestPos === -1) return 1; // fully filled: one solution along this branch
    if (bestCount === 0) return 0; // dead end

    const row = Math.floor(bestPos / SIZE);
    const col = bestPos % SIZE;
    const box = boxOf(row, col);
    let count = 0;
    for (const value of DIGITS) {
      const bit = 1 << value;
      if (!(bestMask & bit)) continue;
      if (count >= remainingLimit) break;
      grid[row][col] = value;
      rowUsed[row] |= bit;
      colUsed[col] |= bit;
      boxUsed[box] |= bit;
      count += search(remainingLimit - count);
      rowUsed[row] &= ~bit;
      colUsed[col] &= ~bit;
      boxUsed[box] &= ~bit;
      grid[row][col] = 0;
      if (budgetExceeded) break;
    }
    return count;
  }

  const count = search(limit);
  return budgetExceeded ? limit + 1 : count;
}

/**
 * Given a puzzle that was uniquely solvable before `(row, col)` was cleared
 * (its old value being `original`), checks whether it still is. Any second
 * solution must put a different value in that cell, so instead of counting
 * solutions from scratch this only searches for one with `original` excluded
 * there — and skips the search entirely when naked/hidden singles already
 * solve the puzzle, which is the common case while plenty of givens remain.
 * Running out of search budget counts as "not unique" (conservative).
 */
function staysUniqueAfterRemoving(puzzle: Grid, row: number, col: number, original: number): boolean {
  if (logicalSolveGap(puzzle) === 0) return true;

  const probe = puzzle.map((r) => [...r]);
  for (const value of DIGITS) {
    if (value === original || !canPlace(probe, row, col, value)) continue;
    probe[row][col] = value;
    if (countSolutions(probe, 1) > 0) return false;
    probe[row][col] = 0;
  }
  return true;
}

/**
 * Removes cells from a solved grid one at a time (in random order), keeping
 * the solution unique at every step, until `minGivens` remain or no more
 * cells can be removed safely. Returns the cells in the order they were
 * removed, so any prefix of the result is itself a valid unique-solution
 * puzzle — letting callers reconstruct puzzles at any givens count between
 * 81 and the final count from a single dig.
 */
export function digHolesOrdered(solved: Grid, minGivens: number): [row: number, col: number][] {
  const puzzle = solved.map((row) => [...row]);
  const positions = shuffled(Array.from({ length: SIZE * SIZE }, (_, i) => i));
  const removalOrder: [number, number][] = [];
  let givens = SIZE * SIZE;

  for (const pos of positions) {
    if (givens <= minGivens) break;
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;
    if (puzzle[row][col] === 0) continue;

    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    if (staysUniqueAfterRemoving(puzzle, row, col, backup)) {
      givens--;
      removalOrder.push([row, col]);
    } else {
      puzzle[row][col] = backup;
    }
  }

  return removalOrder;
}

/** Rebuilds the puzzle state after applying the first `removeCount` removals from `order`. */
export function applyRemovalOrder(
  solved: Grid,
  order: readonly [row: number, col: number][],
  removeCount: number,
): Grid {
  const puzzle = solved.map((row) => [...row]);
  const count = Math.min(removeCount, order.length);
  for (let i = 0; i < count; i++) {
    const [row, col] = order[i];
    puzzle[row][col] = 0;
  }
  return puzzle;
}
