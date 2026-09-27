import { SIZE } from './constants';
import type { Difficulty, Grid } from './types';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** An in-progress game, as stored between sessions. */
export interface SavedGame {
  version: 1;
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
  board: Grid;
  elapsedSeconds: number;
}

export interface DifficultyStats {
  completed: number;
  /** Fastest completion in seconds, or null if never completed. */
  bestSeconds: number | null;
}

export type GameStats = Record<Difficulty, DifficultyStats>;

export function emptyStats(): GameStats {
  return {
    easy: { completed: 0, bestSeconds: null },
    medium: { completed: 0, bestSeconds: null },
    hard: { completed: 0, bestSeconds: null },
  };
}

export function recordCompletion(stats: GameStats, difficulty: Difficulty, seconds: number): GameStats {
  const current = stats[difficulty];
  return {
    ...stats,
    [difficulty]: {
      completed: current.completed + 1,
      bestSeconds: current.bestSeconds === null ? seconds : Math.min(current.bestSeconds, seconds),
    },
  };
}

function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isGrid(value: unknown, allowEmpty: boolean): value is Grid {
  return (
    Array.isArray(value) &&
    value.length === SIZE &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === SIZE &&
        row.every((cell) => Number.isInteger(cell) && cell >= (allowEmpty ? 0 : 1) && cell <= SIZE),
    )
  );
}

function tryParseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function serializeGame(game: SavedGame): string {
  return JSON.stringify(game);
}

/**
 * Parses a stored game, returning null for anything missing, corrupt, or
 * inconsistent (e.g. a board that overwrote a given, or givens that don't
 * match the stored solution) so a bad save can never break startup.
 */
export function parseSavedGame(raw: string | null): SavedGame | null {
  const data = tryParseJson(raw) as Partial<SavedGame> | null;
  if (!data || typeof data !== 'object') return null;
  if (data.version !== 1 || !isDifficulty(data.difficulty) || !isNonNegativeInteger(data.elapsedSeconds)) return null;
  if (!isGrid(data.puzzle, true) || !isGrid(data.solution, false) || !isGrid(data.board, true)) return null;

  const { puzzle, solution, board } = data;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (puzzle[r][c] !== 0 && (puzzle[r][c] !== solution[r][c] || board[r][c] !== puzzle[r][c])) return null;
    }
  }

  return {
    version: 1,
    difficulty: data.difficulty,
    puzzle,
    solution,
    board,
    elapsedSeconds: data.elapsedSeconds,
  };
}

export function serializeStats(stats: GameStats): string {
  return JSON.stringify(stats);
}

/** Parses stored stats, falling back to zeroes for any missing or invalid entry. */
export function parseStats(raw: string | null): GameStats {
  const data = tryParseJson(raw) as Record<string, Partial<DifficultyStats>> | null;
  const stats = emptyStats();
  if (!data || typeof data !== 'object') return stats;

  for (const difficulty of DIFFICULTIES) {
    const entry = data[difficulty];
    if (!entry || typeof entry !== 'object') continue;
    if (isNonNegativeInteger(entry.completed)) stats[difficulty].completed = entry.completed;
    if (isNonNegativeInteger(entry.bestSeconds)) stats[difficulty].bestSeconds = entry.bestSeconds;
  }
  return stats;
}
