import type {
  Assignment,
  BudgetData,
  Category,
  Cents,
  Month,
  Target,
  Transaction,
} from "@ynabe/budget";
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

export type Account = typeof schema.accounts.$inferSelect;

/** A transaction with everything the ledger shows, not just the maths. */
export interface LedgerTransaction extends Transaction {
  accountId: string;
  payee: string;
  memo: string | null;
  cleared: "uncleared" | "cleared" | "reconciled";
  transferAccountId: string | null;
}

export interface Budget extends BudgetData {
  accounts: Account[];
  assignments: Assignment[];
  categories: Category[];
  transactions: LedgerTransaction[];
}

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

/** Reads the budget: what the engine needs, plus accounts and ledger detail. */
export const loadBudget = async (db: Database): Promise<Budget> => {
  const [accountRows, categoryRows, assignmentRows, transactionRows] =
    await Promise.all([
      db.select().from(schema.accounts),
      db
        .select({ category: schema.categories })
        .from(schema.categories)
        .innerJoin(
          schema.categoryGroups,
          eq(schema.categories.groupId, schema.categoryGroups.id)
        )
        .orderBy(schema.categoryGroups.position, schema.categories.position),
      db.select().from(schema.assignments),
      db.select().from(schema.transactions),
    ]);

  return {
    accounts: accountRows,
    assignments: assignmentRows,
    categories: categoryRows.map(({ category }) => categoryOf(category)),
    transactions: transactionRows.map((row) => ({
      accountId: row.accountId,
      amount: row.amount,
      categoryId: row.categoryId,
      cleared: row.cleared,
      date: row.date,
      id: row.id,
      memo: row.memo,
      payee: row.payee,
      transfer: row.transferAccountId !== null,
      transferAccountId: row.transferAccountId,
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
