/** Whole cents. Outflows are negative, inflows positive. */
export type Cents = number;

/** A calendar month, written `YYYY-MM`. */
export type Month = string;

/** Income lands here until it is assigned to a category. */
export const READY_TO_ASSIGN = "ready-to-assign";

export type Target =
  /** Set aside `amount` every month, for bills and regular spending. */
  | { kind: "monthly"; amount: Cents; dueDay?: number }
  /** Build a balance of `amount`, optionally by a month. */
  | { kind: "savings"; amount: Cents; by?: Month };

export interface Category {
  id: string;
  name: string;
  groupId: string;
  target?: Target;
}

export interface Assignment {
  categoryId: string;
  month: Month;
  amount: Cents;
}

export interface Transaction {
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  amount: Cents;
  /**
   * A category id, `READY_TO_ASSIGN` for income, or `null` when it has no
   * category yet. Transfers between accounts carry `null` and `transfer`.
   */
  categoryId: string | null;
  transfer?: boolean;
}

export interface BudgetData {
  categories: readonly Category[];
  assignments: readonly Assignment[];
  transactions: readonly Transaction[];
}

export type CategoryStatus =
  | "overspent"
  | "underfunded"
  | "funded"
  | "available"
  | "empty";

export interface CategoryPlan {
  id: string;
  name: string;
  groupId: string;
  assigned: Cents;
  activity: Cents;
  available: Cents;
  status: CategoryStatus;
  /** What the target still needs this month. Zero without a target. */
  needed: Cents;
  /** 0 to 1: how full the category is against its target. */
  progress: number;
}

export interface MonthPlan {
  month: Month;
  readyToAssign: Cents;
  assigned: Cents;
  activity: Cents;
  available: Cents;
  categories: CategoryPlan[];
  attention: {
    underfunded: number;
    overspent: number;
    needed: Cents;
    /** Transactions this month that still need a category. */
    uncategorized: number;
  };
  /** 0 to 1: the share of this month's target money already assigned. */
  funded: number;
}
