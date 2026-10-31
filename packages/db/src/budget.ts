import type { BudgetData, Category, Cents, Month, Target } from "@ynabe/budget";
import { and, eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import * as schema from "./schema.ts";

/** Any Drizzle SQLite database: D1 in the Worker, bun:sqlite in tests. */
export type Database = BaseSQLiteDatabase<
  "async" | "sync",
  unknown,
  typeof schema
>;

type CategoryRow = typeof schema.categories.$inferSelect;

const targetOf = (row: CategoryRow): Target | undefined => {
  if (row.targetKind === "monthly" && row.targetAmount !== null) {
    return {
      amount: row.targetAmount,
      dueDay: row.targetDueDay ?? undefined,
      kind: "monthly",
    };
  }

  if (row.targetKind === "savings" && row.targetAmount !== null) {
    return {
      amount: row.targetAmount,
      by: row.targetBy ?? undefined,
      kind: "savings",
    };
  }

  return undefined;
};

const categoryOf = (row: CategoryRow): Category => ({
  groupId: row.groupId,
  id: row.id,
  name: row.name,
  target: targetOf(row),
});

/** Reads everything the budget engine needs. */
export const loadBudget = async (db: Database): Promise<BudgetData> => {
  const [categoryRows, assignmentRows, transactionRows] = await Promise.all([
    db.select().from(schema.categories).orderBy(schema.categories.position),
    db.select().from(schema.assignments),
    db.select().from(schema.transactions),
  ]);

  return {
    assignments: assignmentRows,
    categories: categoryRows.map(categoryOf),
    transactions: transactionRows.map((row) => ({
      amount: row.amount,
      categoryId: row.categoryId,
      date: row.date,
      id: row.id,
      transfer: row.transferAccountId !== null,
    })),
  };
};

/** Sets what a category has assigned in a month, replacing the old amount. */
export const assign = async (
  db: Database,
  categoryId: string,
  month: Month,
  amount: Cents
): Promise<void> => {
  if (amount === 0) {
    await db
      .delete(schema.assignments)
      .where(
        and(
          eq(schema.assignments.categoryId, categoryId),
          eq(schema.assignments.month, month)
        )
      );

    return;
  }

  await db
    .insert(schema.assignments)
    .values({ amount, categoryId, month })
    .onConflictDoUpdate({
      set: { amount: sql`excluded.amount` },
      target: [schema.assignments.categoryId, schema.assignments.month],
    });
};
