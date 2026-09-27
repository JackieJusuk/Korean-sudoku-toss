import { describe, expect, it } from 'vitest';
import {
  emptyStats,
  parseSavedGame,
  parseStats,
  recordCompletion,
  serializeGame,
  serializeStats,
} from '../persistence';
import type { SavedGame } from '../persistence';
import { EASY_PUZZLE, EASY_SOLUTION, cloneGrid } from './fixtures';

function savedGame(overrides: Partial<SavedGame> = {}): SavedGame {
  const board = cloneGrid(EASY_PUZZLE);
  board[0][2] = 4; // a user move
  return {
    version: 1,
    difficulty: 'medium',
    puzzle: EASY_PUZZLE,
    solution: EASY_SOLUTION,
    board,
    elapsedSeconds: 42,
    ...overrides,
  };
}

describe('saved game', () => {
  it('round-trips through serialization', () => {
    const game = savedGame();
    expect(parseSavedGame(serializeGame(game))).toEqual(game);
  });

  it('rejects missing or malformed data', () => {
    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame('not json')).toBeNull();
    expect(parseSavedGame('{}')).toBeNull();
    expect(parseSavedGame(JSON.stringify({ ...savedGame(), version: 2 }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ ...savedGame(), difficulty: 'expert' }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ ...savedGame(), elapsedSeconds: -1 }))).toBeNull();
    expect(parseSavedGame(JSON.stringify({ ...savedGame(), board: [[1, 2, 3]] }))).toBeNull();
  });

  it('rejects a board that overwrote a given', () => {
    const board = cloneGrid(savedGame().board);
    board[0][0] = 1; // given is 5
    expect(parseSavedGame(serializeGame(savedGame({ board })))).toBeNull();
  });

  it('rejects givens that disagree with the solution', () => {
    const solution = cloneGrid(EASY_SOLUTION);
    solution[0][0] = 9;
    expect(parseSavedGame(serializeGame(savedGame({ solution })))).toBeNull();
  });
});

describe('stats', () => {
  it('records completions and keeps the best time', () => {
    let stats = emptyStats();
    stats = recordCompletion(stats, 'hard', 300);
    stats = recordCompletion(stats, 'hard', 420);
    stats = recordCompletion(stats, 'hard', 250);
    expect(stats.hard).toEqual({ completed: 3, bestSeconds: 250 });
    expect(stats.easy).toEqual({ completed: 0, bestSeconds: null });
  });

  it('round-trips and tolerates partial or invalid data', () => {
    const stats = recordCompletion(emptyStats(), 'easy', 95);
    expect(parseStats(serializeStats(stats))).toEqual(stats);
    expect(parseStats(null)).toEqual(emptyStats());
    expect(parseStats('garbage')).toEqual(emptyStats());
    expect(parseStats(JSON.stringify({ medium: { completed: 2, bestSeconds: 'fast' } }))).toEqual({
      ...emptyStats(),
      medium: { completed: 2, bestSeconds: null },
    });
  });
});
