import { describe, expect, test } from "bun:test";

import { planMonth } from "@ynabe/budget";

import { readYnab } from "../src/index.ts";

const REGISTER_HEADER =
  '﻿"Account","Flag","Date","Payee","Category Group/Category","Category Group","Category","Memo","Outflow","Inflow","Cleared"';

const PLAN_HEADER =
  '﻿"Month","Category Group/Category","Category Group","Category","Assigned","Activity","Available"';

const csv = (header: string, rows: string[][]) =>
  [
    header,
    ...rows.map((row) =>
      row.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")
    ),
  ].join("\n");

const register = csv(REGISTER_HEADER, [
  [
    "Banca Uno",
    "",
    "01/01/2025",
    "Starting Balance",
    "Inflow: Ready to Assign",
    "Inflow",
    "Ready to Assign",
    "",
    "0.00€",
    "1000.00€",
    "Reconciled",
  ],
  [
    "Banca Uno",
    "",
    "14/01/2025",
    'Bar "Da Pino", Roma',
    "Fun: Eating Out",
    "Fun",
    "Eating Out",
    "two lines\nof memo",
    "12.50€",
    "0.00€",
    "Cleared",
  ],
  [
    "Banca Uno",
    "",
    "20/01/2025",
    "Transfer : Carta Due",
    "",
    "",
    "",
    "",
    "200.00€",
    "0.00€",
    "Cleared",
  ],
  [
    "Carta Due",
    "",
    "20/01/2025",
    "Transfer : Banca Uno",
    "",
    "",
    "",
    "",
    "0.00€",
    "200.00€",
    "Uncleared",
  ],
]);

const plan = csv(PLAN_HEADER, [
  ["Jan 2025", "Bills: Rent", "Bills", "Rent", "450.00€", "0.00€", "450.00€"],
  [
    "Jan 2025",
    "Fun: Eating Out",
    "Fun",
    "Eating Out",
    "10.00€",
    "-12.50€",
    "-2.50€",
  ],
  ["Feb 2025", "Bills: Rent", "Bills", "Rent", "0.00€", "0.00€", "450.00€"],
  [
    "Feb 2025",
    "Fun: Eating Out",
    "Fun",
    "Eating Out",
    "0.00€",
    "0.00€",
    "0.00€",
  ],
]);

describe("readYnab", () => {
  const budget = readYnab(register, plan);

  test("keeps accounts, groups, and categories in YNAB's order", () => {
    expect(budget.accounts).toEqual([
      { id: "banca-uno", name: "Banca Uno" },
      { id: "carta-due", name: "Carta Due" },
    ]);
    expect(budget.groups).toEqual([
      { id: "bills", name: "Bills", position: 0 },
      { id: "fun", name: "Fun", position: 1 },
    ]);
    expect(budget.categories).toEqual([
      { groupId: "bills", id: "bills-rent", name: "Rent", position: 0 },
      { groupId: "fun", id: "fun-eating-out", name: "Eating Out", position: 0 },
    ]);
  });

  test("reads income, spending, quotes, and day-first dates", () => {
    expect(budget.transactions[0]).toMatchObject({
      amount: 100_000,
      categoryId: "ready-to-assign",
      cleared: "reconciled",
      date: "2025-01-01",
    });
    expect(budget.transactions[1]).toMatchObject({
      amount: -1250,
      categoryId: "fun-eating-out",
      date: "2025-01-14",
      memo: "two lines\nof memo",
      payee: 'Bar "Da Pino", Roma',
    });
  });

  test("links both sides of a transfer to the other account", () => {
    expect(budget.transactions[2]).toMatchObject({
      amount: -20_000,
      categoryId: null,
      payee: "Transfer to Carta Due",
      transferAccountId: "carta-due",
    });
    expect(budget.transactions[3]).toMatchObject({
      amount: 20_000,
      payee: "Transfer from Banca Uno",
      transferAccountId: "banca-uno",
    });
  });

  test("keeps only the months that have money assigned", () => {
    expect(budget.assignments).toEqual([
      { amount: 45_000, categoryId: "bills-rent", month: "2025-01" },
      { amount: 1000, categoryId: "fun-eating-out", month: "2025-01" },
    ]);
  });

  test("gives the engine the balances YNAB showed", () => {
    const data = {
      ...budget,
      transactions: budget.transactions.map((transaction) => ({
        ...transaction,
        transfer: transaction.transferAccountId !== null,
      })),
    };

    for (const { available, categoryId, month } of budget.balances) {
      const category = planMonth(data, month).categories.find(
        ({ id }) => id === categoryId
      );

      expect(category?.available).toBe(available);
    }
  });

  test("reads month-first dates when a day cannot be a month", () => {
    const american = csv(REGISTER_HEADER, [
      [
        "Bank",
        "",
        "01/14/2025",
        "Shop",
        "",
        "",
        "",
        "",
        "1.00€",
        "0.00€",
        "Cleared",
      ],
    ]);

    expect(readYnab(american, PLAN_HEADER).transactions[0]?.date).toBe(
      "2025-01-14"
    );
  });

  test("names the row, not its contents, when an amount is wrong", () => {
    const broken = csv(REGISTER_HEADER, [
      [
        "Bank",
        "",
        "01/01/2025",
        "Secret",
        "",
        "",
        "",
        "",
        "abc",
        "0",
        "Cleared",
      ],
    ]);

    expect(() => readYnab(broken, PLAN_HEADER)).toThrow(
      "Register, row 2: an amount is not a number"
    );
  });
});
