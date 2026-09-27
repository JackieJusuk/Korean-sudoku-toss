import { useEffect } from 'react';
import { Board } from './components/Board';
import { DifficultySelector } from './components/DifficultySelector';
import { JamoKeypad } from './components/JamoKeypad';
import { formatTime } from './components/formatTime';
import { Timer } from './components/Timer';
import { useSudoku } from './hooks/useSudoku';
import { lockPortrait, syncSafeAreaInsets } from './platform/toss';

function App() {
  const {
    difficulty,
    board,
    givenMask,
    selected,
    conflicts,
    solved,
    isBusy,
    busyLabel,
    elapsedSeconds,
    stats,
    lastResult,
    newGame,
    selectCell,
    inputValue,
    clearSelected,
  } = useSudoku('easy');

  useEffect(() => {
    lockPortrait();
    return syncSafeAreaInsets();
  }, []);

  const interactionDisabled = isBusy || solved;
  const canInput = selected !== null && !givenMask[selected.row][selected.col];

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ㄱㄴㄷ
          </span>
          <h1>한글 자모 수도쿠</h1>
        </div>
        <DifficultySelector value={difficulty} onChange={newGame} disabled={isBusy} />
      </header>

      <main className="app-main">
        <div className="status-row">
          <Timer seconds={elapsedSeconds} />
          <span className="stats" aria-label="이 난이도 기록">
            완료 {stats.completed}회 · 최고 {stats.bestSeconds === null ? '—' : formatTime(stats.bestSeconds)}
          </span>
          <button
            type="button"
            className="new-game-button"
            onClick={() => newGame(difficulty)}
            disabled={isBusy}
          >
            새 게임
          </button>
        </div>

        <div className="board-wrap">
          <Board
            board={board}
            givenMask={givenMask}
            selected={selected}
            conflicts={conflicts}
            onSelectCell={selectCell}
            disabled={interactionDisabled}
          />

          {isBusy && (
            <div className="board-overlay" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              <span>{busyLabel}</span>
            </div>
          )}

          {!isBusy && solved && (
            <div className="board-overlay solved-overlay" role="status">
              <span aria-hidden="true">🎉</span>
              <span>완성했어요!</span>
              {lastResult && (
                <span className="solved-detail">
                  {formatTime(lastResult.seconds)}
                  {lastResult.isNewBest ? ' · 최고 기록!' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        <JamoKeypad onInput={inputValue} onClear={clearSelected} disabled={!canInput || interactionDisabled} />
      </main>
    </div>
  );
}

export default App;
