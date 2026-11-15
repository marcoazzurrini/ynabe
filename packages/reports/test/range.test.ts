import { describe, expect, test } from "bun:test";

import { READY_TO_ASSIGN } from "@ynabe/budget";
import type { Category } from "@ynabe/budget";

import { rangeReport } from "../src/index.ts";
import type { RangeTransaction } from "../src/range.ts";

const categories: Category[] = [
  { groupId: "bills", id: "rent", name: "Rent" },
  { groupId: "fun", id: "eating", name: "Eating Out" },
  { groupId: "fun", id: "games", name: "Games" },
];

const groups = [
  { id: "bills", name: "Bills" },
  { id: "fun", name: "Fun" },
];

let next = 0;

const row = (
  date: string,
  categoryId: string | null,
  euros: number,
  accountId = "main",
  transfer = false
): RangeTransaction => {
  next += 1;

  return {
    accountId,
    amount: euros * 100,
    categoryId,
    date,
    id: String(next),
    transfer,
  };
};

const transactions: RangeTransaction[] = [
  row("2026-07-01", READY_TO_ASSIGN, 1000),
  row("2026-08-01", "rent", -450),
  row("2026-08-10", "eating", -120),
  row("2026-09-01", "rent", -450),
  row("2026-09-12", "eating", -150, "card"),
  row("2026-10-01", READY_TO_ASSIGN, 3000),
  row("2026-10-01", "rent", -450),
  row("2026-10-02", null, -100, "main", true),
  row("2026-10-02", null, 100, "card", true),
  row("2026-10-20", "games", -60, "card"),
];

const input = { categories, groups, transactions };
const october = { from: "2026-10", to: "2026-10", today: "2026-11" };

describe("rangeReport", () => {
  test("totals one month and ignores transfers", () => {
    const report = rangeReport(input, october);

    expect(report.spent).toBe(51_000);
    expect(report.income).toBe(300_000);
  });

  test("totals a range of months", () => {
    const report = rangeReport(input, { ...october, from: "2026-08" });

    expect(report.spent).toBe(168_000);
    expect(report.slices.map((slice) => [slice.id, slice.spent])).toEqual([
      ["bills", 135_000],
      ["fun", 33_000],
    ]);
  });

  test("shows at least 12 months and marks the range", () => {
    const report = rangeReport(input, { ...october, from: "2026-09" });

    expect(report.months).toHaveLength(12);
    expect(report.months.at(0)?.month).toBe("2025-11");

    expect(
      report.months.filter((month) => month.inRange).map(({ month }) => month)
    ).toEqual(["2026-09", "2026-10"]);
  });

  test("tracks net worth at the end of each month", () => {
    const report = rangeReport(input, october);

    expect(report.months.at(-1)?.netWorth).toBe(232_000);
    expect(report.months.at(-2)?.netWorth).toBe(-17_000);
  });

  test("filters by account", () => {
    const report = rangeReport(input, { ...october, accountId: "card" });

    expect(report.spent).toBe(6000);
    expect(report.income).toBe(0);
    expect(report.months.at(-1)?.netWorth).toBe(-11_000);
  });

  test("filters by category and slices by category", () => {
    const report = rangeReport(input, {
      ...october,
      categoryIds: new Set(["eating", "games"]),
      from: "2026-08",
    });

    expect(report.spent).toBe(33_000);
    expect(report.slices.map((slice) => slice.id)).toEqual(["eating", "games"]);
  });

  test("always gives three calendar months ending with the range", () => {
    const report = rangeReport(input, october);

    expect(report.calendar.map(({ month }) => month)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(report.calendar[2]?.peak).toBe("2026-10-01");
    expect(report.calendar[2]?.days).toHaveLength(31);
    expect(report.calendar[0]?.days[0]?.level).toBe(4);
  });

  test("history runs from the first transaction to today", () => {
    const report = rangeReport(input, october);

    expect(report.history.at(0)?.month).toBe("2026-07");
    expect(report.history.at(-1)?.month).toBe("2026-11");
  });
});
