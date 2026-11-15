import { describe, expect, test } from "bun:test";

import { linkTransfers, readSynci, sync } from "../src/index.ts";
import type { BankRow, SyncedTransaction } from "../src/index.ts";

const held = (
  id: string,
  date: string,
  amount: number,
  rest: Partial<SyncedTransaction> = {}
): SyncedTransaction => ({
  accountId: "bank",
  amount,
  categoryId: null,
  cleared: "cleared",
  date,
  id,
  memo: null,
  payee: id,
  sourceId: null,
  transferAccountId: null,
  ...rest,
});

const sent = (
  id: string,
  date: string,
  amount: number,
  description: string
): BankRow => ({
  amount,
  booked: true,
  date,
  description,
  id,
  payee: description,
});

const waiting = (...row: Parameters<typeof sent>): BankRow => ({
  ...sent(...row),
  booked: false,
});

const accounts = [
  { id: "bank", name: "Bank" },
  { id: "card", name: "Card" },
];

const run = (ledger: SyncedTransaction[], rows: BankRow[]) =>
  sync({ accountId: "bank", accounts, ledger, rows, since: "2025-03-01" });

describe("sync", () => {
  test("adds a bank row the budget does not have", () => {
    const { added, claimed } = run(
      [],
      [sent("900", "2025-03-04", -1250, "Corner Bakery")]
    );

    expect(claimed).toEqual([]);
    expect(added).toEqual([
      held("bank-900", "2025-03-04", -1250, {
        payee: "Corner Bakery",
        sourceId: "900",
      }),
    ]);
  });

  test("ties a bank row to the same payment from a statement", () => {
    const { added, claimed } = run(
      [held("from-statement", "2025-03-02", -1250)],
      [sent("900", "2025-03-04", -1250, "Corner Bakery")]
    );

    expect(added).toEqual([]);
    expect(claimed).toEqual([
      { id: "from-statement", memo: "Corner Bakery", sourceId: "900" },
    ]);
  });

  test("ties each budget row to one bank row only", () => {
    const { added, claimed } = run(
      [held("first", "2025-03-02", -500)],
      [
        sent("900", "2025-03-02", -500, "Coffee Cart"),
        sent("901", "2025-03-03", -500, "Coffee Cart"),
      ]
    );

    expect(claimed).toEqual([
      { id: "first", memo: "Coffee Cart", sourceId: "900" },
    ]);
    expect(added.map(({ sourceId }) => sourceId)).toEqual(["901"]);
  });

  test("gives each row its nearest partner when amounts repeat", () => {
    const { added, claimed } = run(
      [held("early", "2025-03-08", -500), held("late", "2025-03-12", -500)],
      [
        sent("900", "2025-03-02", -500, "Coffee Cart"),
        sent("901", "2025-03-08", -500, "Coffee Cart"),
        sent("902", "2025-03-12", -500, "Coffee Cart"),
      ]
    );

    expect(claimed.map(({ id, sourceId }) => [id, sourceId])).toEqual([
      ["early", "901"],
      ["late", "902"],
    ]);
    expect(added.map(({ sourceId }) => sourceId)).toEqual(["900"]);
  });

  test("skips rows it has seen and never adds rows before the start day", () => {
    const { added, claimed } = run(
      [held("seen", "2025-03-04", -1250, { sourceId: "900" })],
      [
        sent("900", "2025-03-04", -1250, "Corner Bakery"),
        sent("800", "2025-02-27", -700, "Old Shop"),
      ]
    );

    expect(added).toEqual([]);
    expect(claimed).toEqual([]);
  });

  test("learns the bank's name for a payee from rows it ties", () => {
    const { added, claimed } = run(
      [
        held("a", "2025-01-04", -3000, { categoryId: "food", payee: "Bakery" }),
        held("b", "2025-02-04", -2000, { categoryId: "food", payee: "Bakery" }),
      ],
      [
        sent("700", "2025-01-04", -3000, "CORNER BAKERY SRL"),
        sent("701", "2025-02-05", -2000, "CORNER BAKERY SRL"),
        sent("900", "2025-03-04", -1250, "CORNER BAKERY SRL"),
      ]
    );

    expect(claimed.map(({ memo }) => memo)).toEqual([
      "CORNER BAKERY SRL",
      "CORNER BAKERY SRL",
    ]);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ categoryId: "food", payee: "Bakery" });
  });

  test("files a new row the way the same words went before", () => {
    const { added, labelled } = run(
      [
        held("a", "2025-01-04", -3000, {
          categoryId: "food",
          memo: "POS 0401 CORNER BAKERY",
          payee: "Bakery",
        }),
        held("b", "2025-02-04", -2000, {
          categoryId: "food",
          memo: "POS 0402 CORNER BAKERY",
          payee: "Bakery",
        }),
      ],
      [sent("900", "2025-03-04", -1250, "POS 0403 CORNER BAKERY")]
    );

    expect(labelled).toBe(1);
    expect(added[0]).toMatchObject({
      categoryId: "food",
      memo: "POS 0403 CORNER BAKERY",
      payee: "Bakery",
    });
  });

  test("leaves a row plain when the words went two ways", () => {
    const { added } = run(
      [
        held("a", "2025-01-04", -3000, { categoryId: "food", payee: "Market" }),
        held("b", "2025-02-04", -2000, { categoryId: "home", payee: "Market" }),
      ],
      [sent("900", "2025-03-04", -1250, "Market")]
    );

    expect(added[0]?.categoryId).toBeNull();
  });

  test("keeps a transfer whose other side has not arrived yet", () => {
    const topUp = { memo: "TOP UP CARD", transferAccountId: "card" };

    const { added } = run(
      [
        held("a", "2025-01-04", -5000, topUp),
        held("b", "2025-02-04", -5000, topUp),
      ],
      [sent("900", "2025-03-04", -5000, "TOP UP CARD")]
    );

    const { transactions } = linkTransfers({
      accounts,
      added,
      keepUnpaired: true,
      ledger: [],
    });

    expect(transactions[0]).toMatchObject({
      payee: "Transfer to Card",
      transferAccountId: "card",
    });
  });
});

describe("pending payments", () => {
  const coffee = held("bank-900", "2025-03-04", -500, {
    categoryId: "food",
    cleared: "uncleared",
    payee: "Coffee Cart",
    sourceId: "900",
  });

  test("come in uncleared", () => {
    const { added } = run(
      [],
      [waiting("900", "2025-03-04", -500, "Coffee Cart")]
    );

    expect(added[0]).toMatchObject({ cleared: "uncleared", sourceId: "900" });
  });

  test("stay as they are while the bank still holds them", () => {
    const result = run(
      [coffee],
      [waiting("900", "2025-03-04", -500, "Coffee Cart")]
    );

    expect(result).toEqual({
      added: [],
      claimed: [],
      labelled: 0,
      removed: [],
      settled: [],
    });
  });

  test("turn cleared with the final amount when the bank books them", () => {
    const { added, settled } = run(
      [coffee],
      [sent("900", "2025-03-05", -520, "Coffee Cart")]
    );

    expect(added).toEqual([]);
    expect(settled).toEqual([
      {
        amount: -520,
        cleared: "cleared",
        date: "2025-03-05",
        id: "bank-900",
        sourceId: "900",
      },
    ]);
  });

  test("go when the bank drops them: the payment was cancelled", () => {
    const { added, removed } = run(
      [coffee],
      [sent("950", "2025-03-03", -1250, "Corner Bakery")]
    );

    expect(removed).toEqual(["bank-900"]);
    expect(added.map(({ sourceId }) => sourceId)).toEqual(["950"]);
  });

  test("keep their category when the booked payment has a new id", () => {
    const { added, removed, settled } = run(
      [coffee],
      [
        sent("850", "2025-03-02", -1250, "Corner Bakery"),
        sent("901", "2025-03-06", -500, "Coffee Cart"),
      ]
    );

    expect(added.map(({ sourceId }) => sourceId)).toEqual(["850"]);
    expect(removed).toEqual([]);
    expect(settled).toEqual([
      {
        amount: -500,
        cleared: "cleared",
        date: "2025-03-06",
        id: "bank-900",
        sourceId: "901",
      },
    ]);
  });

  test("stay when the feed is empty or does not reach that far back", () => {
    expect(run([coffee], []).removed).toEqual([]);
    expect(
      run([coffee], [sent("950", "2025-03-09", -1250, "Corner Bakery")]).removed
    ).toEqual([]);
  });

  test("never remove a row the sync did not make", () => {
    const typed = { ...coffee, id: "typed-in" };

    const { removed } = run(
      [typed],
      [sent("950", "2025-03-03", -1250, "Corner Bakery")]
    );

    expect(removed).toEqual([]);
  });
});

describe("readSynci", () => {
  const base = {
    amount: "-12.50",
    booked: true,
    booking_date: "2025-03-04",
    currency: "EUR",
    id: 900,
    mapped_fields: { description: "POS CORNER BAKERY", payee: "Corner Bakery" },
  };

  test("reads a booked row in cents", () => {
    expect(readSynci([base])).toEqual([
      {
        amount: -1250,
        booked: true,
        date: "2025-03-04",
        description: "POS CORNER BAKERY",
        id: "900",
        payee: "Corner Bakery",
      },
    ]);
  });

  test("keeps pending rows and leaves out card checks", () => {
    const rows = readSynci([
      { ...base, booked: false },
      { ...base, amount: "0.00" },
    ]);

    expect(rows.map(({ booked }) => booked)).toEqual([false]);
  });

  test("uses the description when the bank names no payee", () => {
    const [row] = readSynci([
      { ...base, mapped_fields: { description: "Top-Up", payee: "" } },
    ]);

    expect(row?.payee).toBe("Top-Up");
  });

  test("names the row, not its contents, when a row is not in euro", () => {
    expect(() => readSynci([{ ...base, currency: "USD" }])).toThrow(
      "Synci, row 1: only euro rows are supported"
    );
  });
});
