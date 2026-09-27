import { BOX_SIZE, DIGITS, SIZE } from './constants';
import type { Grid } from './types';

type CellRef = [row: number, col: number];

/** Bit `d` (1-9) set = digit `d` is still a legal candidate for this cell. */
const ALL_CANDIDATES = 0b11_1111_1110;

function candidateMask(grid: Grid, row: number, col: number): number {
  let used = 0;
  for (let i = 0; i < SIZE; i++) used |= (1 << grid[row][i]) | (1 << grid[i][col]);
  const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;
  for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
    for (let c = boxCol; c < boxCol + BOX_SIZE; c++) used |= 1 << grid[r][c];
  }
  return ALL_CANDIDATES & ~used;
}

/** Candidates in ascending order (the backtracking step count depends on this order). */
function candidatesAt(grid: Grid, row: number, col: number): number[] {
  const mask = candidateMask(grid, row, col);
  return DIGITS.filter((d) => mask & (1 << d));
}

/** Returns the digit if `mask` has exactly one candidate bit set, otherwise 0. */
function singleDigit(mask: number): number {
  if (mask === 0 || (mask & (mask - 1)) !== 0) return 0;
  return 31 - Math.clz32(mask);
}

function collectUnits(): CellRef[][] {
  const units: CellRef[][] = [];
  for (let i = 0; i < SIZE; i++) {
    units.push(Array.from({ length: SIZE }, (_, j) => [i, j]));
    units.push(Array.from({ length: SIZE }, (_, j) => [j, i]));
  }
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_SIZE) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX_SIZE) {
      const cells: CellRef[] = [];
      for (let r = boxRow; r < boxRow + BOX_SIZE; r++) {
        for (let c = boxCol; c < boxCol + BOX_SIZE; c++) cells.push([r, c]);
      }
      units.push(cells);
    }
  }
  return units;
}

const UNITS = collectUnits();

/** "Naked single": a cell with exactly one remaining candidate. */
function applyNakedSingles(grid: Grid): boolean {
  let progress = false;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] !== 0) continue;
      const digit = singleDigit(candidateMask(grid, r, c));
      if (digit !== 0) {
        grid[r][c] = digit;
        progress = true;
      }
    }
  }
  return progress;
}

/** "Hidden single": a digit that can only go in one cell within a row/column/box. */
function applyHiddenSingles(grid: Grid): boolean {
  let progress = false;
  const masks = new Array<number>(SIZE);
  for (const unit of UNITS) {
    unit.forEach(([r, c], i) => {
      masks[i] = grid[r][c] === 0 ? candidateMask(grid, r, c) : 0;
    });
    for (const digit of DIGITS) {
      const bit = 1 << digit;
      let spot = -1;
      let count = 0;
      for (let i = 0; i < SIZE; i++) {
        if (masks[i] & bit) {
          count++;
          spot = i;
          if (count > 1) break;
        }
      }
      if (count === 1) {
        const [r, c] = unit[spot];
        grid[r][c] = digit;
        progress = true;
        // Keep this unit's masks in sync: the cell is filled, and no other
        // cell here could hold `digit` anyway (it had exactly one spot).
        masks[spot] = 0;
      }
    }
  }
  return progress;
}

function reduceByLogic(grid: Grid): void {
  let progress = true;
  while (progress) {
    progress = applyNakedSingles(grid) || applyHiddenSingles(grid);
  }
}

/**
 * Solves as far as basic human techniques (naked/hidden singles) can go without
 * guessing, then returns how many cells are still empty. 0 means the puzzle is
 * "easy" (pure logic); a larger gap means solving it requires deeper deduction
 * or trial-and-error, i.e. a harder puzzle.
 */
export function logicalSolveGap(puzzle: Grid): number {
  const grid = puzzle.map((row) => [...row]);
  reduceByLogic(grid);
  let empty = 0;
  for (const row of grid) {
    for (const value of row) if (value === 0) empty++;
  }
  return empty;
}

/**
 * After exhausting naked/hidden singles, counts how many trial-and-error
 * placements (including dead-end branches) a backtracking solver needs to
 * finish the puzzle. 0 means it never has to guess (pure logic); higher
 * counts mean more ambiguity, i.e. a harder puzzle to solve by hand.
 */
export function estimateSearchSteps(puzzle: Grid, stepCap = 3000): number {
  const grid = puzzle.map((row) => [...row]);
  reduceByLogic(grid);

  let steps = 0;

  function findEmptyCell(): CellRef | null {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function backtrack(): boolean {
    if (steps >= stepCap) return true;
    const empty = findEmptyCell();
    if (!empty) return true;
    const [row, col] = empty;
    for (const value of candidatesAt(grid, row, col)) {
      if (steps >= stepCap) return true;
      steps++;
      grid[row][col] = value;
      if (backtrack()) return true;
      grid[row][col] = 0;
    }
    return false;
  }

  backtrack();
  return steps;
}
