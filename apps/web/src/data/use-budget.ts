import { useLiveQuery } from "@tanstack/react-db";
import { addMonths } from "@ynabe/budget";
import type { BudgetData } from "@ynabe/budget";
import { useMemo } from "react";

import {
  accounts,
  assignments,
  categories,
  groups,
  transactions,
} from "./collections";

/** The whole budget as live data: it re-renders when any collection changes. */
export const useBudget = () => {
  const categoryQuery = useLiveQuery((q) =>
    q
      .from({ category: categories })
      .orderBy(({ category }) => category.groupPosition)
      .orderBy(({ category }) => category.position)
  );

  const assignmentQuery = useLiveQuery((q) =>
    q.from({ assignment: assignments })
  );

  const transactionQuery = useLiveQuery((q) =>
    q.from({ transaction: transactions })
  );

  const accountQuery = useLiveQuery((q) => q.from({ account: accounts }));

  const groupQuery = useLiveQuery((q) =>
    q.from({ group: groups }).orderBy(({ group }) => group.position)
  );

  const data = useMemo(
    (): BudgetData => ({
      assignments: assignmentQuery.data,
      categories: categoryQuery.data,
      transactions: transactionQuery.data,
    }),
    [assignmentQuery.data, categoryQuery.data, transactionQuery.data]
  );

  return {
    accounts: accountQuery.data,
    categories: categoryQuery.data,
    data,
    groups: groupQuery.data,
    ledger: transactionQuery.data,
    ready:
      categoryQuery.isReady &&
      assignmentQuery.isReady &&
      transactionQuery.isReady &&
      accountQuery.isReady &&
      groupQuery.isReady,
  };
};

/** The month the app opens on, as `YYYY-MM`. */
export const currentMonth = (): string => new Date().toISOString().slice(0, 7);

const monthDate = (month: string) => new Date(`${month}-01T12:00:00Z`);

/** `October` */
export const monthName = (month: string): string =>
  monthDate(month).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

/** `Oct` */
export const monthShort = (month: string): string =>
  monthDate(month).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });

export const monthYear = (month: string): string => month.slice(0, 4);

export const previousMonth = (month: string): string => addMonths(month, -1);

export const nextMonth = (month: string): string => addMonths(month, 1);

const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

/** Reads `?month=` from the URL, falling back to the current month. */
export const monthFromSearch = (search: { month?: string }): string =>
  search.month !== undefined && MONTH.test(search.month)
    ? search.month
    : currentMonth();
