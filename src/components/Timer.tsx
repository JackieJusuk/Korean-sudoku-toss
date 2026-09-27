import { formatTime } from './formatTime';

interface TimerProps {
  seconds: number;
}

export function Timer({ seconds }: TimerProps) {
  return (
    <span className="timer" aria-label="경과 시간">
      {formatTime(seconds)}
    </span>
  );
}
