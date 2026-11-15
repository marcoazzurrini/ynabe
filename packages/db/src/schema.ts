import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
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
    /** The bank's id for this row, so a sync never adds it twice. */
    sourceId: text("source_id"),
    transferAccountId: text("transfer_account_id").references(
      () => accounts.id
    ),
  },
  (table) => [
    index("transactions_date").on(table.date),
    index("transactions_account").on(table.accountId),
    uniqueIndex("transactions_source").on(table.sourceId),
  ]
);

/** Which bank account, as the sync service names it, feeds which account. */
export const bankLinks = sqliteTable("bank_links", {
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  /** Bank rows before this day are left out: statements cover them. */
  since: text().notNull(),
  sourceId: text("source_id").primaryKey(),
});

/** The passkeys an account can show as the step after Google sign-in. */
export const passkeys = sqliteTable(
  "passkeys",
  {
    counter: integer().notNull().default(0),
    createdAt: createdAt(),
    email: text().notNull(),
    id: text().primaryKey(),
    /** The public key, as base64url text. */
    publicKey: text("public_key").notNull(),
    /** A JSON list of how the passkey can be reached, such as "internal". */
    transports: text().notNull().default("[]"),
  },
  (table) => [index("passkeys_email").on(table.email)]
);

/** The one passkey request an account has open, used once. */
export const passkeyChallenges = sqliteTable("passkey_challenges", {
  challenge: text().notNull(),
  email: text().primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});

/** Browsers that have shown a passkey, by the hash of their cookie. */
export const secondSteps = sqliteTable("second_steps", {
  email: text().notNull(),
  expiresAt: integer("expires_at").notNull(),
  hash: text().primaryKey(),
});
