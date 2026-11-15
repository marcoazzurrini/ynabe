const DAY = 86_400_000;

/** Whole days between two `YYYY-MM-DD` dates, never negative. */
export const daysBetween = (a: string, b: string): number =>
  Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
