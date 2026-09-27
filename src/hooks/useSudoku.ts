import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzle } from '../game/generator';
import {
  emptyStats,
  parseSavedGame,
  parseStats,
  recordCompletion,
  serializeGame,
  serializeStats,
} from '../game/persistence';
import type { GameStats } from '../game/persistence';
import { createEmptyGrid } from '../game/sudokuCore';
import type { CellPosition, Difficulty, Grid, SudokuPuzzle } from '../game/types';
import { findConflicts, isBoardSolved } from '../game/validator';
import { getGameUserKey, haptic, readItem, removeItem, writeItem } from '../platform/toss';

type Status = 'loading' | 'generating' | 'ready';

export interface CompletionResult {
  seconds: number;
  isNewBest: boolean;
}

interface StorageKeys {
  game: string;
  stats: string;
}

/**
 * Storage keys are scoped by the game user key, so progress follows the Toss
 * user rather than whoever last used the device. Without a user key (older
 * Toss app, plain browser) data falls back to a device-local slot.
 */
function storageKeysFor(userKey: string | null): StorageKeys {
  const scope = userKey ?? 'local';
  return {
    game: `jamo-sudoku:v1:${scope}:game`,
    stats: `jamo-sudoku:v1:${scope}:stats`,
  };
}

function emptyPuzzle(difficulty: Difficulty): SudokuPuzzle {
  return { puzzle: createEmptyGrid(), solution: createEmptyGrid(), difficulty };
}

export function useSudoku(initialDifficulty: Difficulty = 'easy') {
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  // The first puzzle is restored or generated after mount (see the effect
  // below), so the initial render shows an empty board with a spinner instead
  // of blocking first paint on storage reads or puzzle generation.
  const [puzzle, setPuzzle] = useState<SudokuPuzzle>(() => emptyPuzzle(initialDifficulty));
  const [board, setBoard] = useState<Grid>(createEmptyGrid);
  const [selected, setSelected] = useState<CellPosition | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const [lastResult, setLastResult] = useState<CompletionResult | null>(null);

  const startedAtRef = useRef(0);
  const hiddenAtRef = useRef<number | null>(null);
  const generationToken = useRef(0);
  const storageKeysRef = useRef<StorageKeys | null>(null);

  const givenMask = useMemo(
    () => puzzle.puzzle.map((row) => row.map((value) => value !== 0)),
    [puzzle],
  );

  const conflicts = useMemo(() => findConflicts(board), [board]);
  const solved = useMemo(() => isBoardSolved(board), [board]);
  const isBusy = status !== 'ready';

  const currentElapsed = useCallback(() => Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)), []);

  // Puzzle generation can take a few hundred ms on slow devices. Running it
  // synchronously would freeze the whole UI with no feedback, so it's
  // deferred a tick behind `status` flipping to "generating", letting a
  // spinner paint first instead of the page silently hanging.
  const scheduleGeneration = useCallback((nextDifficulty: Difficulty) => {
    const token = ++generationToken.current;
    window.setTimeout(() => {
      if (generationToken.current !== token) return; // superseded by a newer request
      const next = generatePuzzle(nextDifficulty);
      setPuzzle(next);
      setBoard(next.puzzle.map((row) => [...row]));
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setLastResult(null);
      setStatus('ready');
    }, 30);
  }, []);

  const newGame = useCallback(
    (nextDifficulty: Difficulty) => {
      setDifficulty(nextDifficulty);
      setStatus('generating');
      setSelected(null);
      scheduleGeneration(nextDifficulty);
    },
    [scheduleGeneration],
  );

  // On mount: resolve the game user key, load stats, and resume the saved
  // game if there is an unfinished one — otherwise start a fresh puzzle.
  // Under StrictMode this runs twice; the `cancelled` flag drops the first.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const keys = storageKeysFor(await getGameUserKey());
      const [rawStats, rawGame] = await Promise.all([readItem(keys.stats), readItem(keys.game)]);
      if (cancelled) return;

      storageKeysRef.current = keys;
      setStats(parseStats(rawStats));

      const saved = parseSavedGame(rawGame);
      if (saved && !isBoardSolved(saved.board)) {
        generationToken.current++;
        setDifficulty(saved.difficulty);
        setPuzzle({ puzzle: saved.puzzle, solution: saved.solution, difficulty: saved.difficulty });
        setBoard(saved.board);
        startedAtRef.current = Date.now() - saved.elapsedSeconds * 1000;
        setElapsedSeconds(saved.elapsedSeconds);
        setStatus('ready');
      } else {
        setStatus('generating');
        scheduleGeneration(initialDifficulty);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scheduleGeneration, initialDifficulty]);

  const saveProgress = useCallback(() => {
    const keys = storageKeysRef.current;
    if (!keys || status !== 'ready' || solved) return;
    void writeItem(
      keys.game,
      serializeGame({
        version: 1,
        difficulty: puzzle.difficulty,
        puzzle: puzzle.puzzle,
        solution: puzzle.solution,
        board,
        elapsedSeconds: currentElapsed(),
      }),
    );
  }, [status, solved, puzzle, board, currentElapsed]);

  // Persist after every move (and when a new puzzle becomes active).
  useEffect(() => {
    saveProgress();
  }, [saveProgress]);

  // Pause the clock while the mini app is in the background and save on the
  // way out, so closing or switching away never loses progress.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        saveProgress();
      } else if (hiddenAtRef.current !== null) {
        startedAtRef.current += Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', saveProgress);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', saveProgress);
    };
  }, [saveProgress]);

  useEffect(() => {
    if (solved || isBusy) return;
    const interval = window.setInterval(() => {
      if (hiddenAtRef.current === null) setElapsedSeconds(currentElapsed());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [solved, isBusy, currentElapsed]);

  const completeGame = useCallback(() => {
    const seconds = currentElapsed();
    const previousBest = stats[puzzle.difficulty].bestSeconds;
    const nextStats = recordCompletion(stats, puzzle.difficulty, seconds);

    setElapsedSeconds(seconds);
    setStats(nextStats);
    setLastResult({ seconds, isNewBest: previousBest === null || seconds < previousBest });
    setSelected(null);
    haptic('success');

    const keys = storageKeysRef.current;
    if (keys) {
      void writeItem(keys.stats, serializeStats(nextStats));
      void removeItem(keys.game);
    }
  }, [currentElapsed, stats, puzzle.difficulty]);

  // Given cells can be selected too (to highlight every matching jamo), but
  // only empty/user cells accept input.
  const selectCell = useCallback((row: number, col: number) => setSelected({ row, col }), []);

  const inputValue = useCallback(
    (value: number) => {
      if (!selected || isBusy || solved) return;
      const { row, col } = selected;
      if (givenMask[row][col] || board[row][col] === value) return;

      const next = board.map((r) => [...r]);
      next[row][col] = value;
      setBoard(next);
      haptic('tickWeak');
      if (isBoardSolved(next)) completeGame();
    },
    [selected, isBusy, solved, givenMask, board, completeGame],
  );

  const clearSelected = useCallback(() => inputValue(0), [inputValue]);

  return {
    difficulty,
    board,
    givenMask,
    selected,
    conflicts,
    solved,
    isBusy,
    busyLabel: status === 'loading' ? '불러오는 중…' : '퍼즐 만드는 중…',
    elapsedSeconds,
    stats: stats[difficulty],
    lastResult,
    newGame,
    selectCell,
    inputValue,
    clearSelected,
  };
}
