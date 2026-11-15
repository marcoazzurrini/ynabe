import { describe, expect, test } from "bun:test";

import { linkTransfers } from "../src/index.ts";
import type { ImportedTransaction } from "../src/index.ts";

const row = (
  id: string,
  accountId: string,
  date: string,
  amount: number,
  rest: Partial<ImportedTransaction> = {}
): ImportedTransaction => ({
  accountId,
  amount,
  categoryId: null,
  cleared: "cleared",
  date,
  id,
  memo: null,
  payee: id,
  transferAccountId: null,
  ...rest,
});

const accounts = [
  { id: "bank", name: "Bank" },
  { id: "card", name: "Card" },
];

const toCard = { transferAccountId: "card" };
const toBank = { transferAccountId: "bank" };

describe("linkTransfers", () => {
  test("turns a mirrored plain row into the other side", () => {
    const result = linkTransfers({
      accounts,
      added: [
        row("in", "card", "2025-01-10", 5000, toBank),
        row("out", "bank", "2025-01-12", -5000),
      ],
      ledger: [],
    });

    expect(result.transactions[1]).toMatchObject({
      payee: "Transfer to Card",
      transferAccountId: "card",
    });
    expect(result).toMatchObject({ linked: 1, unpaired: 0 });
  });

  test("leaves transfers alone when both sides are there", () => {
    const result = linkTransfers({
      accounts,
      added: [
        row("in", "card", "2025-01-10", 5000, toBank),
        row("out", "bank", "2025-01-10", -5000, toCard),
        row("lunch", "bank", "2025-01-10", -5000),
      ],
      ledger: [],
    });

    expect(result.transactions[2]?.transferAccountId).toBeNull();
    expect(result).toMatchObject({ linked: 0, unpaired: 0 });
  });

  test("pairs with the budget but never changes it", () => {
    const result = linkTransfers({
      accounts,
      added: [row("in", "card", "2025-01-11", 7000, toBank)],
      ledger: [
        row("old", "bank", "2025-01-09", -5000),
        row("old-out", "bank", "2025-01-11", -7000, toCard),
      ],
    });

    expect(result).toMatchObject({ linked: 0, unpaired: 0 });
    expect(result.transactions[0]?.transferAccountId).toBe("bank");
  });

  test("takes back a transfer with no other side in a covered account", () => {
    const result = linkTransfers({
      accounts,
      added: [
        row("guess", "card", "2025-01-10", 5000, {
          ...toBank,
          memo: "Payment from someone",
          payee: "Transfer from Bank",
        }),
        row("late", "bank", "2025-01-14", -5000),
        row("filed", "bank", "2025-01-10", -5000, { categoryId: "rent" }),
        row("other", "bank", "2025-01-10", -4999),
      ],
      ledger: [],
    });

    expect(result).toMatchObject({ linked: 0, unpaired: 1 });
    expect(result.transactions[0]).toMatchObject({
      memo: null,
      payee: "Payment from someone",
      transferAccountId: null,
    });
  });

  test("keeps a transfer to an account that has no statement", () => {
    const result = linkTransfers({
      accounts,
      added: [row("in", "card", "2025-01-10", 5000, toBank)],
      ledger: [],
    });

    expect(result).toMatchObject({ linked: 0, unpaired: 0 });
    expect(result.transactions[0]?.transferAccountId).toBe("bank");
  });
});
