import { describe, expect, test } from "bun:test";

import { READY_TO_ASSIGN } from "@ynabe/budget";
import type { Category, Transaction } from "@ynabe/budget";

import { spendingReport } from "../src/index.ts";

const categories: Category[] = [
  { groupId: "bills", id: "rent", name: "Rent" },
  { groupId: "fun", id: "eating", name: "Eating Out" },
];

let next = 0;

const spend = (
  date: string,
  categoryId: string,
  euros: number
): Transaction => {
  next += 1;

  return { amount: -euros * 100, categoryId, date, id: String(next) };
};

const history: Transaction[] = [
  spend("2026-08-01", "rent", 450),
  spend("2026-08-10", "eating", 120),
  spend("2026-09-01", "rent", 450),
  spend("2026-09-12", "eating", 150),
  {
    amount: 300_000,
    categoryId: READY_TO_ASSIGN,
    date: "2026-10-01",
    id: "pay",
  },
  {
    amount: -10_000,
    categoryId: null,
    date: "2026-10-02",
    id: "move",
    transfer: true,
  },
  spend("2026-10-01", "rent", 450),
  spend("2026-10-04", "eating", 100),
  spend("2026-10-18", "eating", 172),
];

const report = spendingReport(
  { categories, transactions: history },
  "2026-10",
  {
    compare: 2,
  }
);

describe("spendingReport", () => {
  test("totals spending, leaving out income and transfers", () => {
    expect(report.spent).toBe(72_200);
    expect(report.previous).toBe(60_000);
    expect(report.change).toBeCloseTo(72_200 / 60_000 - 1);
  });

  test("tracks the pace of the month against typical months", () => {
    expect(report.pace).toHaveLength(31);
    expect(report.pace.at(-1)?.actual).toBe(72_200);
    expect(report.pace.at(-1)?.typical).toBe(58_500);
    expect(report.pace.at(-1)?.low).toBe(57_000);
    expect(report.pace.at(-1)?.high).toBe(60_000);
  });

  test("flags a category above its usual range", () => {
    const eating = report.categories.find(({ id }) => id === "eating");

    expect(eating?.usual).toEqual({
      average: 13_500,
      high: 15_000,
      low: 12_000,
    });
    expect(eating?.unusual?.direction).toBe("above");
    expect(eating?.unusual?.change).toBeCloseTo(27_200 / 13_500 - 1);
  });

  test("keeps a category within its range unflagged", () => {
    const rent = report.categories.find(({ id }) => id === "rent");

    expect(rent?.unusual).toBeNull();
  });

  test("levels days from no spending to the dearest", () => {
    expect(report.days[1]?.level).toBe(0);
    expect(report.days[0]?.level).toBe(4);
  });
});

describe("spendingReport groups and history", () => {
  const grouped = spendingReport(
    {
      categories,
      groups: [
        { id: "bills", name: "Bills" },
        { id: "fun", name: "Fun" },
      ],
      transactions: history,
    },
    "2026-10",
    { compare: 2 }
  );

  test("adds up groups and compares them with their history", () => {
    const fun = grouped.groups.find(({ id }) => id === "fun");

    expect(fun).toMatchObject({ categoryCount: 1, name: "Fun", spent: 27_200 });
    expect(fun?.unusual?.direction).toBe("above");
  });

  test("reports income and the last 12 months of spending", () => {
    expect(grouped.income).toBe(300_000);
    expect(grouped.months).toHaveLength(12);
    expect(grouped.months.at(-1)).toEqual({ month: "2026-10", spent: 72_200 });
    expect(grouped.months.at(-2)).toEqual({ month: "2026-09", spent: 60_000 });
  });
});
