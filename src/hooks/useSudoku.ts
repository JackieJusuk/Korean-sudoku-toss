import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePuzzle } from '../game/generator';
import { createEmptyGrid } from '../game/sudokuCore';
import type { CellPosition, Difficulty, Grid, SudokuPuzzle } from '../game/types';
import { findConflicts, isBoardSolved } from '../game/validator';

function emptyPuzzle(difficulty: Difficulty): SudokuPuzzle {
  return { puzzle: createEmptyGrid(), solution: createEmptyGrid(), difficulty };
}

export function useSudoku(initialDifficulty: Difficulty = 'easy') {
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  // The first puzzle is generated after mount (see the effect below), so the
  // initial render shows an empty board with the "generating" spinner instead
  // of blocking first paint on puzzle generation.
  const [puzzle, setPuzzle] = useState<SudokuPuzzle>(() => emptyPuzzle(initialDifficulty));
  const [board, setBoard] = useState<Grid>(createEmptyGrid);
  const [selected, setSelected] = useState<CellPosition | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const startedAtRef = useRef(0);
  const generationToken = useRef(0);

  const givenMask = useMemo(
    () => puzzle.puzzle.map((row) => row.map((value) => value !== 0)),
    [puzzle],
  );

  const conflicts = useMemo(() => findConflicts(board), [board]);
  const solved = useMemo(() => isBoardSolved(board), [board]);

  // Puzzle generation can take up to ~1s for hard puzzles. Running it
  // synchronously would freeze the whole UI with no feedback, so it's
  // deferred a tick behind `isGenerating` flipping on, letting a spinner
  // paint first instead of the page silently hanging.
  const scheduleGeneration = useCallback((nextDifficulty: Difficulty) => {
    const token = ++generationToken.current;
    window.setTimeout(() => {
      if (generationToken.current !== token) return; // superseded by a newer request
      const next = generatePuzzle(nextDifficulty);
      setPuzzle(next);
      setBoard(next.puzzle.map((row) => [...row]));
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
      setIsGenerating(false);
    }, 30);
  }, []);

  const newGame = useCallback(
    (nextDifficulty: Difficulty) => {
      setDifficulty(nextDifficulty);
      setIsGenerating(true);
      setSelected(null);
      scheduleGeneration(nextDifficulty);
    },
    [scheduleGeneration],
  );

  // Generate the first puzzle once mounted (state already starts out as
  // "generating"). Under StrictMode this effect runs twice, but the
  // generation token makes the first request a no-op.
  useEffect(() => {
    scheduleGeneration(initialDifficulty);
  }, [scheduleGeneration, initialDifficulty]);

  useEffect(() => {
    if (solved || isGenerating) return;
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [solved, isGenerating]);

  const selectCell = useCallback(
    (row: number, col: number) => {
      if (givenMask[row][col]) return;
      setSelected({ row, col });
    },
    [givenMask],
  );

  const inputValue = useCallback(
    (value: number) => {
      if (!selected) return;
      const { row, col } = selected;
      if (givenMask[row][col]) return;
      setBoard((prev) => {
        const next = prev.map((r) => [...r]);
        next[row][col] = value;
        return next;
      });
    },
    [selected, givenMask],
  );

  const clearSelected = useCallback(() => inputValue(0), [inputValue]);

  return {
    difficulty,
    board,
    givenMask,
    selected,
    conflicts,
    solved,
    isGenerating,
    elapsedSeconds,
    newGame,
    selectCell,
    inputValue,
    clearSelected,
  };
}
