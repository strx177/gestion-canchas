export const COURT_OPEN_MINUTE = 8 * 60;
export const COURT_CLOSE_MINUTE = 21 * 60;
export const COURT_BLOCK_MINUTES = 30;

export const courtBlockStarts = Array.from(
  { length: (COURT_CLOSE_MINUTE - COURT_OPEN_MINUTE) / COURT_BLOCK_MINUTES },
  (_, index) => COURT_OPEN_MINUTE + index * COURT_BLOCK_MINUTES
);

export function formatCourtTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const courtStartTimes = courtBlockStarts.map(formatCourtTime);
export const courtEndTimes = courtBlockStarts.map((minute) => formatCourtTime(minute + COURT_BLOCK_MINUTES));
