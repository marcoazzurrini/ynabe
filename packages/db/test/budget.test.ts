import { Database as Sqlite } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { planMonth } from "@ynabe/budget";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { assign, categorize, loadBudget, setTarget } from "../src/index.ts";
import * as schema from "../src/schema.ts";

const open = () => {
  const db = drizzle(new Sqlite(":memory:"), { schema });

  migrate(db, { migrationsFolder: `${import.meta.dir}/../migrations` });

  return db;
};

describe("budget storage", () => {
  test("round-trips categories, targets, assignments, and transactions", async () => {
    const db = open();

    await db.insert(schema.accounts).values({ id: "revolut", name: "Revolut" });
    await db
      .insert(schema.categoryGroups)
      .values({ id: "bills", name: "Bills" });
    await db.insert(schema.categories).values({
      groupId: "bills",
      id: "rent",
      name: "Rent",
      targetAmount: 45_000,
      targetKind: "monthly",
    });
    await db.insert(schema.transactions).values([
      {
        accountId: "revolut",
        amount: 300_000,
        categoryId: "ready-to-assign",
        date: "2026-10-01",
        id: "pay",
        payee: "Studio Rossi",
      },
      {
        accountId: "revolut",
        amount: -45_000,
        categoryId: "rent",
        date: "2026-10-05",
        id: "rent",
        payee: "Silvano Gambini",
      },
    ]);
    await assign(db, "rent", "2026-10", 30_000);
    await assign(db, "rent", "2026-10", 45_000);

    const plan = planMonth(await loadBudget(db), "2026-10");

    expect(plan.readyToAssign).toBe(255_000);
    expect(plan.categories[0]).toMatchObject({
      assigned: 45_000,
      available: 0,
      status: "funded",
    });
  });

  test("assigning zero removes the assignment", async () => {
    const db = open();

    await db.insert(schema.categoryGroups).values({ id: "fun", name: "Fun" });
    await db
      .insert(schema.categories)
      .values({ groupId: "fun", id: "eating", name: "Eating Out" });
    await assign(db, "eating", "2026-10", 10_000);
    await assign(db, "eating", "2026-10", 0);

    expect(await db.select().from(schema.assignments)).toEqual([]);
  });

  test("categorizes transactions and sets targets", async () => {
    const db = open();

    await db.insert(schema.accounts).values({ id: "revolut", name: "Revolut" });
    await db.insert(schema.categoryGroups).values({ id: "fun", name: "Fun" });
    await db
      .insert(schema.categories)
      .values({ groupId: "fun", id: "eating", name: "Eating Out" });
    await db.insert(schema.transactions).values({
      accountId: "revolut",
      amount: -130,
      categoryId: null,
      date: "2026-10-28",
      id: "coop",
      payee: "Coop",
    });

    await categorize(db, "coop", "eating");
    await setTarget(db, "eating", { amount: 15_000, kind: "monthly" });

    const budget = await loadBudget(db);

    expect(budget.transactions[0]?.categoryId).toBe("eating");
    expect(budget.categories[0]?.target).toEqual({
      amount: 15_000,
      dueDay: undefined,
      kind: "monthly",
    });
  });
});
