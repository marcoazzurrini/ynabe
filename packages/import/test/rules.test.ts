import { describe, expect, test } from "bun:test";

import { applyRules } from "../src/index.ts";
import type { ImportedTransaction } from "../src/index.ts";

const row = (
  payee: string,
  amount: number,
  rest: Partial<ImportedTransaction> = {}
): ImportedTransaction => ({
  accountId: "bank",
  amount,
  categoryId: null,
  cleared: "cleared",
  date: "2025-01-10",
  id: payee,
  memo: null,
  payee,
  transferAccountId: null,
  ...rest,
});

const rules = [
  { category: "food", contains: ["pizzeria"], payees: ["Lidl"] },
  { category: "health", payees: ["Pizzeria Farmacia"] },
  { category: "ready-to-assign", contains: ["/2025"], only: "in" as const },
];

describe("applyRules", () => {
  test("matches a whole payee or a piece of it, whatever the case", () => {
    const { filed, transactions } = applyRules(
      [row("LIDL", -500), row("Pizzeria Da Pino", -900), row("Lidl 2", -100)],
      rules
    );

    expect(transactions.map(({ categoryId }) => categoryId)).toEqual([
      "food",
      "food",
      null,
    ]);
    expect(filed).toBe(2);
  });

  test("prefers a whole-payee match to a partial one", () => {
    const { transactions } = applyRules(
      [row("Pizzeria Farmacia", -500)],
      rules
    );

    expect(transactions[0]?.categoryId).toBe("health");
  });

  test("keeps a rule to money in or money out", () => {
    const { transactions } = applyRules(
      [row("7/2025", 660_000), row("Ticket 7/2025", -100)],
      rules
    );

    expect(transactions.map(({ categoryId }) => categoryId)).toEqual([
      "ready-to-assign",
      null,
    ]);
  });

  test("replaces a guessed category, and reads the bank's text in the memo", () => {
    const { filed, transactions } = applyRules(
      [
        row("Supermarket", -500, { categoryId: "gifts", memo: "LIDL" }),
        row("Lidl", -500, { categoryId: "food" }),
      ],
      rules
    );

    expect(transactions[0]?.categoryId).toBe("food");
    expect(filed).toBe(1);
  });

  test("leaves transfers alone", () => {
    const { filed, transactions } = applyRules(
      [row("Lidl", -500, { transferAccountId: "card" })],
      rules
    );

    expect(transactions[0]?.categoryId).toBeNull();
    expect(filed).toBe(0);
  });
});
