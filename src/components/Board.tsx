import { digitToJamo } from '../game/constants';
import type { CellPosition, Grid } from '../game/types';

interface BoardProps {
  board: Grid;
  givenMask: boolean[][];
  selected: CellPosition | null;
  conflicts: Set<string>;
  onSelectCell: (row: number, col: number) => void;
  disabled?: boolean;
}

function isPeer(a: CellPosition, row: number, col: number): boolean {
  if (a.row === row && a.col === col) return false;
  if (a.row === row || a.col === col) return true;
  return Math.floor(a.row / 3) === Math.floor(row / 3) && Math.floor(a.col / 3) === Math.floor(col / 3);
}

export function Board({ board, givenMask, selected, conflicts, onSelectCell, disabled = false }: BoardProps) {
  const selectedValue = selected ? board[selected.row][selected.col] : 0;

  return (
    <div className="sudoku-board" role="grid" aria-label="자모 수도쿠 보드">
      {board.map((row, r) => (
        <div className="sudoku-row" role="row" key={r}>
          {row.map((value, c) => {
            const isGiven = givenMask[r][c];
            const isSelected = selected?.row === r && selected?.col === c;
            const isConflict = conflicts.has(`${r},${c}`);
            const isPeerOfSelected = selected ? isPeer(selected, r, c) : false;
            const isSameValue = !isSelected && selectedValue !== 0 && value === selectedValue;
            const boxShade = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 === 1;

            const classNames = ['sudoku-cell'];
            if (isGiven) classNames.push('given');
            if (boxShade) classNames.push('box-shade');
            if (isPeerOfSelected) classNames.push('peer');
            if (isSameValue) classNames.push('same-value');
            if (isSelected) classNames.push('selected');
            if (isConflict) classNames.push('conflict');
            if (c % 3 === 0) classNames.push('border-left-thick');
            if (r % 3 === 0) classNames.push('border-top-thick');
            if (c === 8) classNames.push('border-right-thick');
            if (r === 8) classNames.push('border-bottom-thick');

            return (
              <button
                type="button"
                key={c}
                role="gridcell"
                className={classNames.join(' ')}
                onClick={() => onSelectCell(r, c)}
                aria-selected={isSelected}
                aria-readonly={isGiven}
                disabled={disabled}
              >
                {digitToJamo(value)}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
