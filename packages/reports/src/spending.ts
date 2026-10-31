import { addMonths, monthOf, READY_TO_ASSIGN } from "@ynabe/budget";
import type { Category, Cents, Month, Transaction } from "@ynabe/budget";

export interface PacePoint {
  day: number;
  /** Spent so far this month. */
  actual: Cents;
  /** Spent by this day in an average comparison month. */
  typical: Cents;
  low: Cents;
  high: Cents;
}

export interface SpendingDay {
  date: string;
  spent: Cents;
  /** 0 for no spending, then 1 to 4 from cheapest to dearest days. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface UsualRange {
  low: Cents;
  high: Cents;
  average: Cents;
}

export interface CategorySpending {
  id: string;
  name: string;
  groupId: string;
  spent: Cents;
  /** 0 to 1 of the month's spending. */
  share: number;
  /** Null until there is at least one comparison month. */
  usual: UsualRange | null;
  /** How far above or below its usual range, or null when within it. */
  unusual: { direction: "above" | "below"; change: number } | null;
}

export interface SpendingReport {
  month: Month;
  spent: Cents;
  previous: Cents;
  /** Change against the previous month, as a ratio: -0.062 is 6.2% less. */
  change: number | null;
  dailyAverage: Cents;
  /** Weekend daily spending divided by weekday daily spending. */
  weekendRatio: number | null;
  pace: PacePoint[];
  days: SpendingDay[];
  categories: CategorySpending[];
}

interface SpendingInput {
  categories: readonly Category[];
  transactions: readonly Transaction[];
}

interface ReportOptions {
  /** Months before this one to compare against. */
  compare?: number;
}

const daysIn = (month: Month): number => {
  const [year, index] = month.split("-").map(Number);

  return new Date(Date.UTC(year, index, 0)).getUTCDate();
};

const isSpending = (transaction: Transaction): boolean =>
  !transaction.transfer &&
  transaction.categoryId !== null &&
  transaction.categoryId !== READY_TO_ASSIGN;

const average = (values: readonly number[]): number =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;

/** Daily spending for one month, indexed from day 1. */
const dailySpending = (
  transactions: readonly Transaction[],
  month: Month
): Cents[] => {
  const days = Array.from({ length: daysIn(month) }, () => 0);

  for (const transaction of transactions) {
    if (isSpending(transaction) && monthOf(transaction.date) === month) {
      const day = Number(transaction.date.slice(8, 10));

      days[day - 1] -= transaction.amount;
    }
  }

  return days;
};

const cumulative = (days: readonly Cents[]): Cents[] => {
  let total = 0;

  return days.map((spent) => {
    total += spent;

    return total;
  });
};

/** Ranks days with spending into four levels; the dearest day is always 4. */
const levels = (days: readonly Cents[]): SpendingDay["level"][] => {
  const spending = days.filter((spent) => spent > 0).toSorted((a, b) => a - b);

  return days.map((spent) => {
    if (spent <= 0) {
      return 0;
    }

    const rank = spending.lastIndexOf(spent) + 1;
    const level = Math.ceil((rank / spending.length) * 4);

    if (level <= 1) {
      return 1;
    }

    if (level === 2) {
      return 2;
    }

    return level === 3 ? 3 : 4;
  });
};

const spentByCategory = (
  transactions: readonly Transaction[],
  month: Month
): Map<string, Cents> => {
  const totals = new Map<string, Cents>();

  for (const transaction of transactions) {
    if (
      isSpending(transaction) &&
      transaction.categoryId !== null &&
      monthOf(transaction.date) === month
    ) {
      totals.set(
        transaction.categoryId,
        (totals.get(transaction.categoryId) ?? 0) - transaction.amount
      );
    }
  }

  return totals;
};

/**
 * Explains a month of spending: how it compares with the previous month
 * and with a typical month, which days cost the most, and which
 * categories left their usual range.
 */
export const spendingReport = (
  input: SpendingInput,
  month: Month,
  { compare = 6 }: ReportOptions = {}
): SpendingReport => {
  const days = dailySpending(input.transactions, month);
  const spent = days.reduce((total, value) => total + value, 0);

  const comparison = Array.from({ length: compare }, (_, index) =>
    addMonths(month, -(index + 1))
  );

  const pastDays = comparison.map((past) =>
    dailySpending(input.transactions, past)
  );

  const previous = pastDays[0]?.reduce((total, value) => total + value, 0) ?? 0;

  // Compare by share of the month, so a 28-day February lines up with a
  // 31-day October.
  const pastCurves = pastDays
    .filter((past) => past.some((value) => value > 0))
    .map((past) => {
      const curve = cumulative(past);

      return days.map(
        (_, index) =>
          curve[
            Math.min(
              curve.length - 1,
              Math.round(((index + 1) / days.length) * curve.length) - 1
            )
          ] ?? 0
      );
    });

  const actual = cumulative(days);

  const pace = days.map((_, index): PacePoint => {
    const atDay = pastCurves.map((curve) => curve[index] ?? 0);

    return {
      actual: actual[index] ?? 0,
      day: index + 1,
      high: atDay.length === 0 ? 0 : Math.max(...atDay),
      low: atDay.length === 0 ? 0 : Math.min(...atDay),
      typical: Math.round(average(atDay)),
    };
  });

  const dayLevels = levels(days);

  const spendingDays = days.map((value, index): SpendingDay => ({
    date: `${month}-${String(index + 1).padStart(2, "0")}`,
    level: dayLevels[index] ?? 0,
    spent: value,
  }));

  const weekend: Cents[] = [];
  const weekday: Cents[] = [];

  for (const day of spendingDays) {
    const weekdayIndex = new Date(`${day.date}T12:00:00Z`).getUTCDay();

    (weekdayIndex === 0 || weekdayIndex === 6 ? weekend : weekday).push(
      day.spent
    );
  }

  const thisMonth = spentByCategory(input.transactions, month);

  const pastMonths = comparison.map((past) =>
    spentByCategory(input.transactions, past)
  );

  const activePast = pastMonths.filter((totals) => totals.size > 0);

  const categories = input.categories
    .map((category): CategorySpending => {
      const value = thisMonth.get(category.id) ?? 0;
      const history = activePast.map((totals) => totals.get(category.id) ?? 0);

      const usual = history.every((amount) => amount === 0)
        ? null
        : {
            average: Math.round(average(history)),
            high: Math.max(...history),
            low: Math.min(...history),
          };

      let unusual: CategorySpending["unusual"] = null;

      if (usual && value > usual.high && usual.average > 0) {
        unusual = { change: value / usual.average - 1, direction: "above" };
      } else if (usual && value < usual.low && usual.average > 0) {
        unusual = { change: value / usual.average - 1, direction: "below" };
      }

      return {
        groupId: category.groupId,
        id: category.id,
        name: category.name,
        share: spent === 0 ? 0 : value / spent,
        spent: value,
        unusual,
        usual,
      };
    })
    .filter((category) => category.spent !== 0 || category.usual !== null)
    .toSorted((a, b) => b.spent - a.spent);

  const weekdayAverage = average(weekday);

  return {
    categories,
    change: previous === 0 ? null : spent / previous - 1,
    dailyAverage: Math.round(spent / days.length),
    days: spendingDays,
    month,
    pace,
    previous,
    spent,
    weekendRatio:
      weekdayAverage === 0 ? null : average(weekend) / weekdayAverage,
  };
};
