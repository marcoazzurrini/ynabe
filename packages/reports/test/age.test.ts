import { describe, expect, test } from "bun:test";

import { READY_TO_ASSIGN } from "@ynabe/budget";

import { ageOfMoney } from "../src/index.ts";

describe("ageOfMoney", () => {
  test("is null without spending", () => {
    expect(ageOfMoney([])).toBeNull();
  });

  test("ages each outflow by the oldest unspent income", () => {
    const age = ageOfMoney([
      {
        amount: 10_000,
        categoryId: READY_TO_ASSIGN,
        date: "2026-09-01",
        id: "a",
      },
      {
        amount: 10_000,
        categoryId: READY_TO_ASSIGN,
        date: "2026-10-01",
        id: "b",
      },
      { amount: -5000, categoryId: "food", date: "2026-10-11", id: "c" },
      { amount: -10_000, categoryId: "rent", date: "2026-10-21", id: "d" },
    ]);

    // c is 40 days old. d spends 5,000 at 50 days and 5,000 at 20 days: 35.
    expect(age).toBe(Math.round((40 + 35) / 2));
  });
});
