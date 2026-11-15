import { describe, expect, test } from "bun:test";

import { planMonth } from "@ynabe/budget";

import { replayMonths } from "../src/index.ts";

const categories = [
  { groupId: "g", id: "food", name: "Food" },
  { groupId: "g", id: "rainy-day", name: "Rainy Day" },
  { groupId: "g", id: "holiday", name: "Holiday" },
];

const spend = (
  id: string,
  date: string,
  amount: number,
  categoryId: string
) => ({
  amount,
  categoryId,
  date,
  id,
});

// January is budgeted: 1,000 in, 100 for food, 600 and 300 saved.
const data = {
  assignments: [
    { amount: 10_000, categoryId: "food", month: "2025-01" },
    { amount: 60_000, categoryId: "rainy-day", month: "2025-01" },
    { amount: 30_000, categoryId: "holiday", month: "2025-01" },
  ],
  categories,
  transactions: [
    spend("pay", "2025-01-01", 100_000, "ready-to-assign"),
    spend("jan", "2025-01-10", -4000, "food"),
    // February and March: no income but 200 in March, and food goes on.
    spend("feb", "2025-02-10", -50_000, "food"),
    spend("mar-pay", "2025-03-01", 20_000, "ready-to-assign"),
    spend("mar", "2025-03-10", -45_000, "food"),
  ],
};

describe("replayMonths", () => {
  const replay = replayMonths({
    data,
    drawFrom: ["rainy-day", "holiday"],
    until: "2025-03",
  });

  const after = {
    ...data,
    assignments: [...data.assignments, ...replay.assignments],
  };

  test("uses what a category held before asking for more", () => {
    // Food held 60 from January, so February's 500 needs 440.
    expect(replay.assignments[0]).toEqual({
      amount: 44_000,
      categoryId: "food",
      month: "2025-02",
    });
  });

  test("takes the missing money from savings, in the order given", () => {
    expect(replay.drawn).toEqual([
      { amount: 60_000, categoryId: "rainy-day" },
      { amount: 9000, categoryId: "holiday" },
    ]);
    expect(replay.short).toBe(0);
  });

  test("spends new income before it touches savings", () => {
    // March needs 450 and earns 200, so savings give 250.
    const march = replay.assignments.filter(({ month }) => month === "2025-03");

    expect(march).toEqual([
      { amount: 45_000, categoryId: "food", month: "2025-03" },
      { amount: -16_000, categoryId: "rainy-day", month: "2025-03" },
      { amount: -9000, categoryId: "holiday", month: "2025-03" },
    ]);
  });

  test("ends with nothing overspent and nothing over-assigned", () => {
    expect(planMonth(after, "2025-02").attention.overspent).toBe(0);

    const march = planMonth(after, "2025-03");

    expect(march.attention.overspent).toBe(0);
    expect(march.readyToAssign).toBe(0);
    expect(march.available).toBe(21_000);
  });

  test("says what is still missing when savings run out", () => {
    const poor = replayMonths({
      data,
      drawFrom: ["holiday"],
      until: "2025-03",
    });

    expect(poor.short).toBe(39_000);
  });
});
