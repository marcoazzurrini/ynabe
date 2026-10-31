import { describe, expect, test } from "bun:test";

import { planMonth, READY_TO_ASSIGN } from "../src/index.ts";
import type { BudgetData, Category } from "../src/index.ts";

const rent: Category = {
  groupId: "bills",
  id: "rent",
  name: "Rent",
  target: { amount: 45_000, kind: "monthly" },
};

const eatingOut: Category = {
  groupId: "fun",
  id: "eating",
  name: "Eating Out",
};

const holiday: Category = {
  groupId: "goals",
  id: "holiday",
  name: "Holiday",
  target: { amount: 120_000, by: "2026-12", kind: "savings" },
};

const salary = (date: string, amount: number) => ({
  amount,
  categoryId: READY_TO_ASSIGN,
  date,
  id: `salary-${date}`,
});

const budget = (data: Partial<BudgetData>): BudgetData => ({
  assignments: [],
  categories: [rent, eatingOut, holiday],
  transactions: [],
  ...data,
});

const category = (plan: ReturnType<typeof planMonth>, id: string) => {
  const found = plan.categories.find((entry) => entry.id === id);

  if (!found) {
    throw new Error(`No category ${id}`);
  }

  return found;
};

describe("planMonth", () => {
  test("income is ready to assign until it is assigned", () => {
    const data = budget({
      assignments: [{ amount: 45_000, categoryId: "rent", month: "2026-10" }],
      transactions: [salary("2026-10-01", 300_000)],
    });

    expect(planMonth(data, "2026-10").readyToAssign).toBe(255_000);
  });

  test("assigning ahead also comes out of ready to assign", () => {
    const data = budget({
      assignments: [{ amount: 45_000, categoryId: "rent", month: "2026-11" }],
      transactions: [salary("2026-10-01", 300_000)],
    });

    expect(planMonth(data, "2026-10").readyToAssign).toBe(255_000);
  });

  test("leftover money rolls into the next month", () => {
    const data = budget({
      assignments: [{ amount: 10_000, categoryId: "eating", month: "2026-09" }],
      transactions: [
        { amount: -4000, categoryId: "eating", date: "2026-09-12", id: "a" },
      ],
    });

    expect(category(planMonth(data, "2026-10"), "eating").available).toBe(6000);
  });

  test("overspending resets to zero and comes out of ready to assign", () => {
    const data = budget({
      assignments: [{ amount: 10_000, categoryId: "eating", month: "2026-09" }],
      transactions: [
        salary("2026-09-01", 50_000),
        { amount: -15_240, categoryId: "eating", date: "2026-09-20", id: "a" },
      ],
    });

    const september = planMonth(data, "2026-09");
    expect(category(september, "eating").status).toBe("overspent");
    expect(category(september, "eating").available).toBe(-5240);

    const october = planMonth(data, "2026-10");
    expect(category(october, "eating").available).toBe(0);
    expect(october.readyToAssign).toBe(50_000 - 10_000 - 5240);
  });

  test("a monthly target is underfunded until fully assigned", () => {
    const partly = planMonth(
      budget({
        assignments: [{ amount: 30_000, categoryId: "rent", month: "2026-10" }],
      }),
      "2026-10"
    );

    expect(category(partly, "rent")).toMatchObject({
      needed: 15_000,
      progress: 30_000 / 45_000,
      status: "underfunded",
    });

    const fully = planMonth(
      budget({
        assignments: [{ amount: 45_000, categoryId: "rent", month: "2026-10" }],
      }),
      "2026-10"
    );

    expect(category(fully, "rent")).toMatchObject({
      needed: 0,
      status: "funded",
    });
  });

  test("a savings target spreads what is left over the months remaining", () => {
    const data = budget({
      assignments: [
        { amount: 30_000, categoryId: "holiday", month: "2026-09" },
      ],
    });

    // 90,000 left over October, November, December.
    expect(category(planMonth(data, "2026-10"), "holiday").needed).toBe(30_000);
  });

  test("funded is the share of target money already assigned", () => {
    const data = budget({
      assignments: [
        { amount: 45_000, categoryId: "rent", month: "2026-10" },
        { amount: 10_000, categoryId: "holiday", month: "2026-10" },
      ],
    });

    // Rent wants 45,000 and has it. Holiday wants 40,000 and has 10,000.
    expect(planMonth(data, "2026-10").funded).toBeCloseTo(55_000 / 85_000);
  });

  test("counts transactions that still need a category", () => {
    const data = budget({
      transactions: [
        { amount: -199, categoryId: null, date: "2026-10-29", id: "a" },
        {
          amount: -10_000,
          categoryId: null,
          date: "2026-10-30",
          id: "b",
          transfer: true,
        },
      ],
    });

    const plan = planMonth(data, "2026-10");
    expect(plan.attention.uncategorized).toBe(1);
    expect(plan.readyToAssign).toBe(-199);
  });
});
