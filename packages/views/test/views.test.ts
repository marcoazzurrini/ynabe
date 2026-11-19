import { describe, expect, test } from "bun:test";

import {
  accountSummaries,
  groupSummary,
  inLedgerFilter,
  ledgerDays,
  ledgerRows,
  planGroups,
  planNote,
  planView,
  spendingHeadline,
  targetText,
  usualCategory,
} from "../src/index.ts";
import type {
  LedgerEntry,
  LedgerFilter,
  LedgerInput,
  PlanInput,
} from "../src/index.ts";

const entry = (
  id: string,
  date: string,
  amount: number,
  categoryId: string | null,
  rest: Partial<LedgerEntry> = {}
): LedgerEntry => ({
  accountId: "revolut",
  amount,
  categoryId,
  cleared: "cleared",
  date,
  id,
  memo: null,
  payee: "Coop",
  transferAccountId: null,
  ...rest,
});

const transactions = [
  entry("pay", "2026-08-01", 300_000, "ready-to-assign", { payee: "Studio" }),
  entry("a", "2026-09-10", -2000, "out"),
  entry("b", "2026-10-02", -9000, "out"),
  entry("c", "2026-10-02", -1500, "groceries"),
  entry("d", "2026-10-03", -1299, null, { cleared: "uncleared" }),
  entry("e", "2026-10-03", 10_000, null, {
    accountId: "illimity",
    payee: "Transfer",
    transferAccountId: "revolut",
  }),
];

const budget: PlanInput & Pick<LedgerInput, "accounts" | "transactions"> = {
  accounts: [
    { closed: false, id: "revolut", kind: "card", name: "Revolut" },
    { closed: false, id: "illimity", kind: "checking", name: "Illimity" },
    { closed: true, id: "old", kind: "cash", name: "Old" },
  ],
  assignments: [
    { amount: 4000, categoryId: "out", month: "2026-09" },
    { amount: 5000, categoryId: "out", month: "2026-10" },
    { amount: 20_000, categoryId: "rent", month: "2026-10" },
  ],
  categories: [
    { groupId: "fun", icon: "utensils", id: "out", name: "Eating Out" },
    { groupId: "fun", icon: null, id: "groceries", name: "Groceries" },
    {
      groupId: "bills",
      icon: "house",
      id: "rent",
      name: "Rent",
      target: { amount: 45_000, dueDay: 25, kind: "monthly" },
    },
  ],
  groups: [
    { id: "bills", name: "Bills" },
    { id: "fun", name: "Fun" },
    { id: "empty", name: "Empty" },
  ],
  transactions,
};

describe("the Plan screen", () => {
  const view = planView(budget, "2026-10");
  const row = (id: string) => view.rows.find((found) => found.id === id);

  test("lists groups in their order, without empty ones", () => {
    expect(view.groups.map(({ name }) => name)).toEqual(["Bills", "Fun"]);
  });

  test("gives each row its icon, target, and the months before", () => {
    expect(row("out")).toMatchObject({
      average: Math.round(4000 / 3),
      icon: "utensils",
      lastMonth: 4000,
    });
    expect(row("out")?.history.slice(-2)).toEqual([
      { assigned: 4000, month: "2026-09", spent: 2000 },
      { assigned: 5000, month: "2026-10", spent: 9000 },
    ]);
  });

  test("says what an underfunded or overspent row needs", () => {
    const rent = row("rent");
    const out = row("out");

    expect(rent && planNote(rent, "2026-10")).toEqual({
      text: "Needs 250.00€ by Oct 25",
      tone: "under",
    });
    expect(out && planNote(out, "2026-10")).toEqual({
      text: "Overspent by 20.00€",
      tone: "over",
    });
  });

  test("filters rows and drops groups left empty", () => {
    expect(
      planGroups(view, "attention").map(({ rows }) => rows.map(({ id }) => id))
    ).toEqual([["rent"], ["out", "groceries"]]);
    expect(planGroups(view, "funded")).toEqual([]);
  });

  test("sums a group up in a line", () => {
    const [bills] = view.groups;

    expect(groupSummary(bills?.rows ?? [])).toMatchObject({
      available: 20_000,
      text: "1 needs money",
      underfunded: 1,
    });
  });

  test("words a target", () => {
    expect(targetText({ amount: 1, dueDay: 25, kind: "monthly" })).toBe(
      "every month, by the 25th"
    );
    expect(targetText({ amount: 1, by: "2027-06", kind: "savings" })).toBe(
      "saved by June 2027"
    );
    expect(targetText(undefined)).toBeNull();
  });
});

describe("the Accounts screen", () => {
  const rows = ledgerRows(budget);

  const ids = (filter: LedgerFilter, search = "") =>
    rows
      .filter((found) => inLedgerFilter(found, filter, search))
      .map(({ id }) => id);

  test("joins names and guesses a category from the payee's history", () => {
    expect(rows.find(({ id }) => id === "d")).toMatchObject({
      accountName: "Revolut",
      categoryName: null,
      guess: "Eating Out",
      guessId: "out",
    });
    expect(rows.find(({ id }) => id === "e")).toMatchObject({
      guess: null,
      transferName: "Revolut",
    });
    expect(usualCategory(" Coop ", transactions)).toBe("out");
    expect(usualCategory("Nobody", transactions)).toBeNull();
  });

  test("groups rows by day, newest first, with each day's net", () => {
    const days = ledgerDays(rows);

    expect(days.map(({ date, total }) => [date, total]).slice(0, 2)).toEqual([
      ["2026-10-03", 8701],
      ["2026-10-02", -10_500],
    ]);
  });

  test("filters by state and by search", () => {
    expect(ids("uncleared")).toEqual(["d"]);
    expect(ids("uncategorized")).toEqual(["d"]);
    expect(ids("transfers")).toEqual(["e"]);
    expect(ids("all", "groceries")).toEqual(["c"]);
  });

  test("sums each open account, and all of them first", () => {
    expect(accountSummaries(budget)).toEqual([
      {
        balance: 296_201,
        kind: "all",
        name: "All accounts",
        uncleared: { count: 1, sum: -1299 },
      },
      {
        balance: 286_201,
        id: "revolut",
        kind: "card",
        name: "Revolut",
        uncleared: { count: 1, sum: -1299 },
      },
      {
        balance: 10_000,
        id: "illimity",
        kind: "checking",
        name: "Illimity",
        uncleared: { count: 0, sum: 0 },
      },
    ]);
  });
});

const group = (name: string, change: number | null) => ({
  name,
  unusual: change === null ? null : { change, direction: "above" as const },
});

describe("the Reflect screen", () => {
  test("sums the month up against the one before", () => {
    expect(
      spendingHeadline({
        change: -0.062,
        groups: [group("Bills", null), group("Fun", 0.39), group("Food", 0.1)],
        month: "2026-10",
        spent: 191_816,
      })
    ).toEqual({
      aside: "Fun is the exception.",
      lead: "October was 6.2% lighter than September.",
    });
    expect(
      spendingHeadline({
        change: 0.2,
        groups: [],
        month: "2026-01",
        spent: 5000,
      })
    ).toEqual({
      aside: null,
      lead: "January was 20.0% heavier than December.",
    });
  });

  test("has words for a month with nothing to compare", () => {
    expect(
      spendingHeadline({ change: null, groups: [], month: "2026-10", spent: 0 })
        .lead
    ).toBe("Nothing spent in October yet.");
    expect(
      spendingHeadline({
        change: null,
        groups: [],
        month: "2026-10",
        spent: 100,
      }).lead
    ).toBe("October is the first month with spending.");
  });
});
