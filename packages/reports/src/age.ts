import { READY_TO_ASSIGN } from "@ynabe/budget";
import type { Transaction } from "@ynabe/budget";

const DAY = 86_400_000;

const dayNumber = (date: string) =>
  Math.round(Date.parse(`${date}T12:00:00Z`) / DAY);

/**
 * How old money is when it is spent, in days: the average over the last
 * `window` outflows, matching each outflow to the oldest income still
 * unspent. Null until there is enough history to say.
 */
export const ageOfMoney = (
  transactions: readonly Transaction[],
  window = 10
): number | null => {
  const ordered = transactions
    .filter((transaction) => !transaction.transfer)
    .toSorted((a, b) => a.date.localeCompare(b.date));

  const income: { day: number; left: number }[] = [];
  const ages: number[] = [];

  for (const transaction of ordered) {
    const day = dayNumber(transaction.date);

    if (transaction.categoryId === READY_TO_ASSIGN && transaction.amount > 0) {
      income.push({ day, left: transaction.amount });
      continue;
    }

    if (transaction.amount >= 0) {
      continue;
    }

    let owed = -transaction.amount;
    let weighted = 0;

    while (owed > 0 && income.length > 0) {
      const [oldest] = income;

      if (!oldest) {
        break;
      }

      const used = Math.min(owed, oldest.left);

      weighted += used * (day - oldest.day);
      oldest.left -= used;
      owed -= used;

      if (oldest.left === 0) {
        income.shift();
      }
    }

    const covered = -transaction.amount - owed;

    if (covered > 0) {
      ages.push(weighted / covered);
    }
  }

  const recent = ages.slice(-window);

  return recent.length === 0
    ? null
    : Math.round(recent.reduce((total, age) => total + age, 0) / recent.length);
};
