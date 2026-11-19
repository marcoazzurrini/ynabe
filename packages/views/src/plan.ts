import { addMonths, formatMoney, planMonth } from "@ynabe/budget";
import type {
  BudgetData,
  Category,
  CategoryPlan,
  Month,
  MonthPlan,
  Target,
} from "@ynabe/budget";

/** The budget as the Plan screen needs it: the engine's data, plus names. */
export interface PlanInput extends BudgetData {
  categories: readonly (Category & { icon: string | null })[];
  /** In the order the screen lists them. */
  groups: readonly { id: string; name: string }[];
}

/** One category in a month, with what its detail shows. */
export interface PlanRow extends CategoryPlan {
  icon: string | null;
  target?: Target;
  /** What was assigned the month before. */
  lastMonth: number;
  /** The average assigned over the three months before. */
  average: number;
  /** Oldest first: what was assigned and spent in each of the last 6 months. */
  history: { month: string; assigned: number; spent: number }[];
}

export interface PlanGroup {
  id: string;
  name: string;
  rows: PlanRow[];
}

export interface PlanView {
  plan: MonthPlan;
  /** Every category, in plan order. */
  rows: PlanRow[];
  /** The rows by group, in group order. Groups without rows are left out. */
  groups: PlanGroup[];
}

export type PlanFilter = "all" | "attention" | "funded";

/** Whether a row shows under a filter of the Plan screen. */
export const inPlanFilter = (row: PlanRow, filter: PlanFilter): boolean => {
  if (filter === "attention") {
    return row.status === "underfunded" || row.status === "overspent";
  }

  if (filter === "funded") {
    return row.status === "funded" || row.status === "available";
  }

  return true;
};

/** The rows by group, keeping only those the filter shows. */
export const planGroups = (view: PlanView, filter: PlanFilter): PlanGroup[] =>
  view.groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) => inPlanFilter(row, filter)),
    }))
    .filter((group) => group.rows.length > 0);

/** How many months back a row's detail looks, this month included. */
const SPAN = 7;

/** One month of the plan, as the Plan screen shows it. */
export const planView = (budget: PlanInput, month: Month): PlanView => {
  const plans = Array.from({ length: SPAN }, (_, index) =>
    planMonth(budget, addMonths(month, index - (SPAN - 1)))
  );

  const plan = plans.at(-1) ?? planMonth(budget, month);
  const previous = plans.at(-2);
  const sources = new Map(budget.categories.map((entry) => [entry.id, entry]));

  // Each month's categories by id, so a row's history is a lookup.
  const byMonth = plans.map(
    (entry) => new Map(entry.categories.map((found) => [found.id, found]))
  );

  const rows = plan.categories.map((category): PlanRow => {
    const source = sources.get(category.id);

    const past = byMonth
      .slice(3, 6)
      .map((entry) => entry.get(category.id)?.assigned ?? 0);

    return {
      ...category,
      average: Math.round(
        past.reduce((sum, value) => sum + value, 0) / Math.max(1, past.length)
      ),
      history: plans.slice(1).map((entry, index) => {
        const found = byMonth[index + 1]?.get(category.id);

        return {
          assigned: found?.assigned ?? 0,
          month: entry.month,
          spent: Math.max(0, -(found?.activity ?? 0)),
        };
      }),
      icon: source?.icon ?? null,
      lastMonth:
        previous?.categories.find(({ id }) => id === category.id)?.assigned ??
        0,
      target: source?.target,
    };
  });

  const groups = budget.groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      rows: rows.filter((row) => row.groupId === group.id),
    }))
    .filter((group) => group.rows.length > 0);

  return { groups, plan, rows };
};

const monthShort = (month: Month) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });

const lastDay = (month: Month) =>
  new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  ).getUTCDate();

export interface PlanNote {
  tone: "over" | "under";
  text: string;
}

/** What a row needs said about it, or null when it needs nothing. */
export const planNote = (row: PlanRow, month: Month): PlanNote | null => {
  if (row.status === "overspent") {
    return {
      text: `Overspent by ${formatMoney(-row.available)}`,
      tone: "over",
    };
  }

  if (row.status === "underfunded") {
    const due =
      row.target?.kind === "monthly"
        ? `by ${monthShort(month)} ${row.target.dueDay ?? lastDay(month)}`
        : "this month";

    return { text: `Needs ${formatMoney(row.needed)} ${due}`, tone: "under" };
  }

  return null;
};

/** A target in words, after its amount: `every month, by the 31st`. */
export const targetText = (target: Target | undefined): string | null => {
  if (!target) {
    return null;
  }

  if (target.kind === "monthly") {
    return target.dueDay
      ? `every month, by the ${target.dueDay}th`
      : "every month";
  }

  return target.by
    ? `saved by ${new Date(`${target.by}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC", year: "numeric" })}`
    : "saved";
};

/** How far a row is toward its target, in cents. */
export const targetReached = (row: PlanRow): number =>
  row.target?.kind === "monthly" ? row.assigned : Math.max(0, row.available);

/** How a group stands: its total, and how many rows are in each state. */
export interface GroupSummary {
  available: number;
  funded: number;
  underfunded: number;
  overspent: number;
  /** Rows with nothing to say: no money and no target asking for any. */
  quiet: number;
  text: string;
}

export const groupSummary = (rows: readonly PlanRow[]): GroupSummary => {
  const count = (...statuses: PlanRow["status"][]) =>
    rows.filter((row) => statuses.includes(row.status)).length;

  const funded = count("funded", "available");
  const underfunded = count("underfunded");
  const overspent = count("overspent");

  const parts = [
    funded > 0 ? `${funded} funded` : null,
    underfunded > 0
      ? `${underfunded} ${underfunded === 1 ? "needs" : "need"} money`
      : null,
    overspent > 0 ? `${overspent} overspent` : null,
  ].filter((part) => part !== null);

  return {
    available: rows.reduce((sum, row) => sum + row.available, 0),
    funded,
    overspent,
    quiet: count("empty"),
    text: parts.length > 0 ? parts.join(" · ") : "Nothing assigned",
    underfunded,
  };
};
