import {
  addMonths,
  compareMonths,
  monthOf,
  READY_TO_ASSIGN,
} from "@ynabe/budget";
import type { Category, Cents, Month, Transaction } from "@ynabe/budget";

import { daysIn, isSpending, levels } from "./spending.ts";
import type { SpendingDay } from "./spending.ts";

/** A transaction that knows which account it belongs to. */
export type RangeTransaction = Transaction & { accountId?: string };

export interface RangeInput {
  categories: readonly Category[];
  transactions: readonly RangeTransaction[];
  groups: readonly { id: string; name: string }[];
}

export interface RangeFilter {
  /** First month of the range. */
  from: Month;
  /** Last month of the range. */
  to: Month;
  /** The month the slider history runs up to, usually the current month. */
  today: Month;
  /** Only count this account. */
  accountId?: string;
  /** Only count spending in these categories. */
  categoryIds?: ReadonlySet<string>;
}

export interface RangeMonth {
  month: Month;
  spent: Cents;
  /** The balance of the counted accounts at the end of the month. */
  netWorth: Cents;
  inRange: boolean;
}

export interface RangeSlice {
  id: string;
  name: string;
  spent: Cents;
  /** 0 to 1 of the range's spending. */
  share: number;
}

export interface CalendarMonth {
  month: Month;
  spent: Cents;
  days: SpendingDay[];
  /** The date of the most expensive day, or null without spending. */
  peak: string | null;
}

export interface RangeReport {
  /** Income that reached Ready to Assign in the range. */
  income: Cents;
  spent: Cents;
  /** At least 12 months ending with the range's last month. */
  months: RangeMonth[];
  /** Groups, or categories when a category filter is set. Biggest first. */
  slices: RangeSlice[];
  /** The three months ending with the range's last month. */
  calendar: CalendarMonth[];
  /** Spending for every month from the first transaction to `today`. */
  history: { month: Month; spent: Cents }[];
}

const monthsFrom = (from: Month, to: Month): Month[] => {
  const months: Month[] = [];

  for (
    let month = from;
    compareMonths(month, to) <= 0;
    month = addMonths(month, 1)
  ) {
    months.push(month);
  }

  return months;
};

const earliest = (a: Month, b: Month): Month =>
  compareMonths(a, b) <= 0 ? a : b;

const latest = (a: Month, b: Month): Month =>
  compareMonths(a, b) >= 0 ? a : b;

const add = (totals: Map<string, Cents>, key: string, amount: Cents) => {
  totals.set(key, (totals.get(key) ?? 0) + amount);
};

/**
 * Summarizes a range of months: income and spending, a month-by-month
 * history with net worth, where the money went, and a daily calendar.
 * The account filter applies to everything; the category filter applies
 * to spending only.
 */
export const rangeReport = (
  input: RangeInput,
  { from, to, today, accountId, categoryIds }: RangeFilter
): RangeReport => {
  const inRange = (month: Month) =>
    compareMonths(month, from) >= 0 && compareMonths(month, to) <= 0;

  const spentByMonth = new Map<Month, Cents>();
  const spentByDay = new Map<string, Cents>();
  const spentByCategory = new Map<string, Cents>();
  const movedByMonth = new Map<Month, Cents>();
  let income = 0;
  let first = earliest(from, today);

  for (const transaction of input.transactions) {
    if (accountId !== undefined && transaction.accountId !== accountId) {
      continue;
    }

    const month = monthOf(transaction.date);

    first = earliest(first, month);
    add(movedByMonth, month, transaction.amount);

    if (
      transaction.categoryId === READY_TO_ASSIGN &&
      !transaction.transfer &&
      inRange(month)
    ) {
      income += transaction.amount;
    }

    if (
      isSpending(transaction) &&
      transaction.categoryId !== null &&
      (categoryIds === undefined || categoryIds.has(transaction.categoryId))
    ) {
      add(spentByMonth, month, -transaction.amount);
      add(spentByDay, transaction.date, -transaction.amount);

      if (inRange(month)) {
        add(spentByCategory, transaction.categoryId, -transaction.amount);
      }
    }
  }

  const last = latest(to, today);
  const balances = new Map<Month, Cents>();
  let balance = 0;

  for (const month of monthsFrom(first, last)) {
    balance += movedByMonth.get(month) ?? 0;
    balances.set(month, balance);
  }

  const months = monthsFrom(earliest(from, addMonths(to, -11)), to).map(
    (month): RangeMonth => ({
      inRange: inRange(month),
      month,
      netWorth: balances.get(month) ?? 0,
      spent: spentByMonth.get(month) ?? 0,
    })
  );

  const spent = months
    .filter((month) => month.inRange)
    .reduce((total, month) => total + month.spent, 0);

  const slice = (id: string, name: string, value: Cents): RangeSlice => ({
    id,
    name,
    share: spent === 0 ? 0 : value / spent,
    spent: value,
  });

  const slices = (
    categoryIds === undefined
      ? input.groups.map((group) =>
          slice(
            group.id,
            group.name,
            input.categories
              .filter((category) => category.groupId === group.id)
              .reduce(
                (total, category) =>
                  total + (spentByCategory.get(category.id) ?? 0),
                0
              )
          )
        )
      : input.categories
          .filter((category) => categoryIds.has(category.id))
          .map((category) =>
            slice(
              category.id,
              category.name,
              spentByCategory.get(category.id) ?? 0
            )
          )
  )
    .filter((entry) => entry.spent !== 0)
    .toSorted((a, b) => b.spent - a.spent);

  const calendarMonths = monthsFrom(addMonths(to, -2), to);

  const calendarDays = calendarMonths.map((month) =>
    Array.from({ length: daysIn(month) }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;

      return { date, spent: spentByDay.get(date) ?? 0 };
    })
  );

  // Rank days across all three months, so the same color means the same
  // amount in every month.
  const dayLevels = levels(
    calendarDays.flat().map((day) => Math.max(0, day.spent))
  );

  let offset = 0;

  const calendar = calendarMonths.map((month, index): CalendarMonth => {
    const days = (calendarDays[index] ?? []).map(
      (day, dayIndex): SpendingDay => ({
        ...day,
        level: dayLevels[offset + dayIndex] ?? 0,
      })
    );

    offset += days.length;

    let peak: SpendingDay | null = null;

    for (const day of days) {
      if (day.spent > 0 && (peak === null || day.spent > peak.spent)) {
        peak = day;
      }
    }

    return {
      days,
      month,
      peak: peak?.date ?? null,
      spent: days.reduce((total, day) => total + day.spent, 0),
    };
  });

  return {
    calendar,
    history: monthsFrom(first, last).map((month) => ({
      month,
      spent: spentByMonth.get(month) ?? 0,
    })),
    income,
    months,
    slices,
    spent,
  };
};
