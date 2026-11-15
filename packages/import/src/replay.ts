import { addMonths, planMonth } from "@ynabe/budget";
import type { Assignment, BudgetData, Cents, Month } from "@ynabe/budget";

export interface ReplayInput {
  /** The budget, with every transaction up to `until` in it. */
  data: BudgetData;
  /** The last month to replay. */
  until: Month;
  /**
   * Categories that paid when a month spent more than it earned, in the
   * order they were emptied. Savings first, as a rule.
   */
  drawFrom: readonly string[];
}

export interface Replay {
  /** New assignments for the months nobody budgeted. */
  assignments: Assignment[];
  /** What each `drawFrom` category gave up, in total. */
  drawn: { categoryId: string; amount: Cents }[];
  /** What was still missing in `until` after every category gave all it had. */
  short: Cents;
}

/**
 * Budgets the months after the last one a person budgeted, the way they
 * would have had to: each month, money goes to every category that
 * spent more than it held, and when that is more than there was to
 * assign, it comes out of the `drawFrom` categories.
 */
export const replayMonths = ({
  data,
  drawFrom,
  until,
}: ReplayInput): Replay => {
  const last = data.assignments
    .map(({ month }) => month)
    .toSorted()
    .at(-1);

  const assignments: Assignment[] = [];
  const drawn = new Map<string, Cents>();
  let short = 0;

  const planOf = (month: Month) =>
    planMonth(
      { ...data, assignments: [...data.assignments, ...assignments] },
      month
    );

  for (
    let month = last ? addMonths(last, 1) : until;
    month <= until;
    month = addMonths(month, 1)
  ) {
    for (const { available, id } of planOf(month).categories) {
      if (available < 0) {
        assignments.push({ amount: -available, categoryId: id, month });
      }
    }

    const covered = planOf(month);

    short = Math.max(0, -covered.readyToAssign);

    for (const categoryId of drawFrom) {
      const held =
        covered.categories.find(({ id }) => id === categoryId)?.available ?? 0;

      const amount = Math.min(held, short);

      if (amount > 0) {
        assignments.push({ amount: -amount, categoryId, month });
        drawn.set(categoryId, (drawn.get(categoryId) ?? 0) + amount);
        short -= amount;
      }
    }
  }

  return {
    assignments,
    drawn: [...drawn].map(([categoryId, amount]) => ({ amount, categoryId })),
    short,
  };
};
