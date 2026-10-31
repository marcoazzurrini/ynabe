import { useLiveQuery } from "@tanstack/react-db";
import type { BudgetData } from "@ynabe/budget";
import { useMemo } from "react";

import { assignments, categories, transactions } from "./collections";

/** The whole budget as live data: it re-renders when any collection changes. */
export const useBudget = () => {
  const categoryQuery = useLiveQuery((q) => q.from({ category: categories }));

  const assignmentQuery = useLiveQuery((q) =>
    q.from({ assignment: assignments })
  );

  const transactionQuery = useLiveQuery((q) =>
    q.from({ transaction: transactions })
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
    data,
    ready:
      categoryQuery.isReady &&
      assignmentQuery.isReady &&
      transactionQuery.isReady,
  };
};

/** The month the app opens on, as `YYYY-MM`. */
export const currentMonth = (): string => new Date().toISOString().slice(0, 7);

export const monthTitle = (month: string): string =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  });

export const groupTitle = (groupId: string): string =>
  groupId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
