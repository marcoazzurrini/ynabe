import { addMonths, compareMonths, monthOf, monthsBetween } from "./month.ts";
import { READY_TO_ASSIGN } from "./types.ts";
import type {
  BudgetData,
  Category,
  CategoryPlan,
  CategoryStatus,
  Cents,
  Month,
  MonthPlan,
} from "./types.ts";

type Ledger = Map<Month, Map<string, Cents>>;

interface TargetNeed {
  needed: Cents;
  progress: number;
}

const add = (ledger: Ledger, month: Month, key: string, amount: Cents) => {
  const row = ledger.get(month) ?? new Map<string, Cents>();
  row.set(key, (row.get(key) ?? 0) + amount);
  ledger.set(month, row);
};

const read = (ledger: Ledger, month: Month, key: string): Cents =>
  ledger.get(month)?.get(key) ?? 0;

const sum = (values: Iterable<Cents>): Cents => {
  let total = 0;

  for (const value of values) {
    total += value;
  }

  return total;
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const UNCATEGORIZED = "";
const INCOME = READY_TO_ASSIGN;

/** Sorts every amount into the month and bucket it belongs to. */
const index = (data: BudgetData) => {
  const assigned: Ledger = new Map();
  const activity: Ledger = new Map();
  let first: Month | undefined;

  const see = (month: Month) => {
    if (first === undefined || compareMonths(month, first) < 0) {
      first = month;
    }
  };

  for (const { categoryId, month, amount } of data.assignments) {
    add(assigned, month, categoryId, amount);
    see(month);
  }

  for (const transaction of data.transactions) {
    if (transaction.transfer) {
      continue;
    }

    const month = monthOf(transaction.date);
    add(
      activity,
      month,
      transaction.categoryId ?? UNCATEGORIZED,
      transaction.amount
    );
    see(month);
  }

  return { activity, assigned, first };
};

const targetNeed = (
  category: Category,
  month: Month,
  carried: Cents,
  assigned: Cents,
  available: Cents
): TargetNeed => {
  const { target } = category;

  if (!target || target.amount <= 0) {
    return { needed: 0, progress: available > 0 ? 1 : 0 };
  }

  if (target.kind === "monthly") {
    return {
      needed: Math.max(0, target.amount - assigned),
      progress: clamp(assigned / target.amount),
    };
  }

  const progress = clamp(available / target.amount);

  if (target.by === undefined) {
    return { needed: 0, progress };
  }

  const monthsLeft = Math.max(1, monthsBetween(month, target.by) + 1);
  const remaining = Math.max(0, target.amount - carried);
  const perMonth = Math.ceil(remaining / monthsLeft);

  return { needed: Math.max(0, perMonth - assigned), progress };
};

const statusOf = (
  category: Category,
  available: Cents,
  needed: Cents
): CategoryStatus => {
  if (available < 0) {
    return "overspent";
  }

  if (needed > 0) {
    return "underfunded";
  }

  if (category.target) {
    return "funded";
  }

  return available > 0 ? "available" : "empty";
};

/**
 * Works out a month of the budget: what every category has, what targets
 * still need, and how much income is ready to assign.
 *
 * Money left in a category rolls into the next month. Overspending does
 * not: the category starts the next month at zero, and the overspent
 * amount comes out of Ready to Assign instead.
 */
export const planMonth = (data: BudgetData, month: Month): MonthPlan => {
  const { activity, assigned, first } = index(data);
  const carried = new Map<string, Cents>();
  let overspentBefore = 0;
  let income = 0;
  let uncategorized = 0;
  let assignedSoFar = 0;

  const start = first && compareMonths(first, month) < 0 ? first : month;

  for (let at = start; compareMonths(at, month) < 0; at = addMonths(at, 1)) {
    income += read(activity, at, INCOME);
    uncategorized += read(activity, at, UNCATEGORIZED);
    assignedSoFar += sum(assigned.get(at)?.values() ?? []);

    for (const category of data.categories) {
      const balance =
        (carried.get(category.id) ?? 0) +
        read(assigned, at, category.id) +
        read(activity, at, category.id);

      if (balance < 0) {
        overspentBefore -= balance;
      }

      carried.set(category.id, Math.max(0, balance));
    }
  }

  income += read(activity, month, INCOME);
  uncategorized += read(activity, month, UNCATEGORIZED);
  let assignedLater = 0;

  for (const [at, row] of assigned) {
    if (compareMonths(at, month) >= 0) {
      assignedLater += sum(row.values());
    }
  }

  const categories = data.categories.map((category): CategoryPlan => {
    const carry = carried.get(category.id) ?? 0;
    const assignedNow = read(assigned, month, category.id);
    const activityNow = read(activity, month, category.id);
    const available = carry + assignedNow + activityNow;

    const { needed, progress } = targetNeed(
      category,
      month,
      carry,
      assignedNow,
      available
    );

    return {
      activity: activityNow,
      assigned: assignedNow,
      available,
      groupId: category.groupId,
      id: category.id,
      name: category.name,
      needed,
      progress,
      status: statusOf(category, available, needed),
    };
  });

  let wanted = 0;
  let covered = 0;

  for (const plan of categories) {
    const category = data.categories.find(({ id }) => id === plan.id);

    if (category?.target) {
      const want = plan.assigned + plan.needed;
      wanted += want;
      covered += Math.min(plan.assigned, want);
    }
  }

  const monthTransactions = data.transactions.filter(
    (transaction) =>
      !transaction.transfer &&
      transaction.categoryId === null &&
      monthOf(transaction.date) === month
  );

  return {
    activity: sum(categories.map((plan) => plan.activity)),
    assigned: sum(categories.map((plan) => plan.assigned)),
    attention: {
      needed: sum(categories.map((plan) => plan.needed)),
      overspent: categories.filter((plan) => plan.status === "overspent")
        .length,
      uncategorized: monthTransactions.length,
      underfunded: categories.filter((plan) => plan.status === "underfunded")
        .length,
    },
    available: sum(categories.map((plan) => plan.available)),
    categories,
    funded: wanted === 0 ? 1 : covered / wanted,
    month,
    readyToAssign:
      income - assignedSoFar - assignedLater - overspentBefore + uncategorized,
  };
};
