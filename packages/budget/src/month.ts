import type { Month } from "./types.ts";

const MONTH = /^(?<year>\d{4})-(?<month>0[1-9]|1[0-2])$/u;

const parts = (month: Month): [number, number] => {
  const match = MONTH.exec(month);

  if (!match) {
    throw new RangeError(`Expected a month like 2026-10, got "${month}"`);
  }

  return [Number(match.groups?.year), Number(match.groups?.month)];
};

export const monthOf = (date: string): Month => date.slice(0, 7);

export const addMonths = (month: Month, count: number): Month => {
  const [year, index] = parts(month);
  const total = year * 12 + (index - 1) + count;
  const next = (total % 12) + 1;

  return `${Math.floor(total / 12)}-${String(next).padStart(2, "0")}`;
};

/** Whole months from `from` to `to`; negative when `to` is earlier. */
export const monthsBetween = (from: Month, to: Month): number => {
  const [fromYear, fromIndex] = parts(from);
  const [toYear, toIndex] = parts(to);

  return (toYear - fromYear) * 12 + (toIndex - fromIndex);
};

export const compareMonths = (a: Month, b: Month): number =>
  monthsBetween(b, a);
