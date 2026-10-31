import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const accounts = sqliteTable("accounts", {
  closed: integer({ mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  id: text().primaryKey(),
  kind: text({ enum: ["checking", "savings", "card", "cash", "tracking"] })
    .notNull()
    .default("checking"),
  name: text().notNull(),
});

export const categoryGroups = sqliteTable("category_groups", {
  createdAt: createdAt(),
  id: text().primaryKey(),
  name: text().notNull(),
  position: integer().notNull().default(0),
});

export const categories = sqliteTable(
  "categories",
  {
    createdAt: createdAt(),
    groupId: text("group_id")
      .notNull()
      .references(() => categoryGroups.id, { onDelete: "cascade" }),
    icon: text(),
    id: text().primaryKey(),
    name: text().notNull(),
    position: integer().notNull().default(0),
    targetAmount: integer("target_amount"),
    targetBy: text("target_by"),
    targetDueDay: integer("target_due_day"),
    targetKind: text("target_kind", { enum: ["monthly", "savings"] }),
  },
  (table) => [index("categories_group").on(table.groupId)]
);

export const assignments = sqliteTable(
  "assignments",
  {
    amount: integer().notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    month: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.categoryId, table.month] })]
);

export const transactions = sqliteTable(
  "transactions",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: integer().notNull(),
    /** A category id, "ready-to-assign" for income, or null. */
    categoryId: text("category_id"),
    cleared: text({ enum: ["uncleared", "cleared", "reconciled"] })
      .notNull()
      .default("uncleared"),
    createdAt: createdAt(),
    date: text().notNull(),
    id: text().primaryKey(),
    memo: text(),
    payee: text().notNull(),
    transferAccountId: text("transfer_account_id").references(
      () => accounts.id
    ),
  },
  (table) => [
    index("transactions_date").on(table.date),
    index("transactions_account").on(table.accountId),
  ]
);
