import { describe, expect, test } from "bun:test";

import { strToU8, zipSync } from "fflate";

import { backfill, readIllimity, readRevolut } from "../src/index.ts";
import type { ImportedTransaction } from "../src/index.ts";

const HEADER =
  "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance";

const statement = [
  HEADER,
  "Deposit,Current,2024-12-28 09:00:00,2024-12-28 09:00:01,Top-up by *1234,30.00,0.00,EUR,COMPLETED,108.00",
  "Card Payment,Current,2024-12-29 12:00:00,2024-12-30 08:00:00,Bar Pino 0001,-8.00,0.00,EUR,COMPLETED,100.00",
  "Deposit,Current,2025-01-02 09:00:00,2025-01-02 09:00:01,Top-up by *1234,50.00,0.00,EUR,COMPLETED,150.00",
  "Card Payment,Current,2025-01-03 12:00:00,2025-01-04 08:00:00,Bar Pino 0042,-10.00,0.00,EUR,COMPLETED,140.00",
  "Card Payment,Current,2025-01-05 20:00:00,2025-01-07 08:00:00,Old Shop,-5.00,0.00,EUR,COMPLETED,135.00",
  "Deposit,Current,2025-01-08 09:00:00,2025-01-08 09:00:01,Top-up by *1234,20.00,0.00,EUR,COMPLETED,155.00",
  "Card Payment,Current,2025-01-09 12:00:00,2025-01-10 08:00:00,Bar Pino 0077,-12.00,0.50,EUR,COMPLETED,142.50",
  "Card Payment,Current,2025-01-09 12:00:00,2025-01-10 08:00:00,Bar Pino 0077,-12.00,0.50,EUR,COMPLETED,130.00",
  "Card Payment,Current,2025-01-11 12:00:00,,New Shop,-3.00,0.00,EUR,PENDING,",
  "Card Payment,Current,2025-01-11 13:00:00,,New Shop,-4.00,0.00,EUR,REVERTED,",
  "Card Payment,Current,2025-01-12 09:00:00,2025-01-12 09:00:05,Old Shop,-7.00,0.00,EUR,COMPLETED,123.00",
  "ATM,Current,2025-01-12 10:00:00,2025-01-12 10:00:05,Cash at Bancomat,-30.00,0.00,EUR,COMPLETED,93.00",
].join("\n");

const row = (
  id: string,
  date: string,
  amount: number,
  rest: Partial<ImportedTransaction> = {}
): ImportedTransaction => ({
  accountId: "revolut",
  amount,
  categoryId: null,
  cleared: "reconciled",
  date,
  id,
  memo: null,
  payee: id,
  transferAccountId: null,
  ...rest,
});

// The budget stops on 5 January and is 2.00 short of the bank that day.
const ledger = [
  row("start", "2024-12-01", 7600, { categoryId: "ready-to-assign" }),
  row("topup-0", "2024-12-28", 3000, {
    payee: "Transfer from Illimity",
    transferAccountId: "illimity",
  }),
  row("bar-0", "2024-12-29", -800, { categoryId: "eating-out", payee: "Pino" }),
  row("topup", "2025-01-02", 5000, {
    payee: "Transfer from Illimity",
    transferAccountId: "illimity",
  }),
  row("bar", "2025-01-03", -1000, { categoryId: "eating-out", payee: "Pino" }),
  row("shop", "2025-01-05", -500, { categoryId: "stuff" }),
  row("other-bank", "2025-01-09", -1250, { accountId: "illimity" }),
];

const accounts = [
  { id: "revolut", name: "Revolut" },
  { id: "illimity", name: "Illimity" },
];

describe("readRevolut", () => {
  test("keeps settled rows and takes fees off the amount", () => {
    const rows = readRevolut(statement);

    expect(rows).toHaveLength(10);
    expect(rows[6]).toEqual({
      amount: -1250,
      at: "2025-01-09 12:00:00",
      balance: 14_250,
      date: "2025-01-09",
      description: "Bar Pino 0077",
      kind: "Card Payment",
      settled: "2025-01-10",
    });
  });

  test("refuses a statement in another currency", () => {
    const pounds = statement.replace("EUR,COMPLETED", "GBP,COMPLETED");

    expect(() => readRevolut(pounds)).toThrow(
      "Statement, row 2: only euro statements are supported"
    );
  });
});

type Cell = { text: string } | { number: number } | null;

const t = (text: string): Cell => ({ text });
const n = (number: number): Cell => ({ number });

/** A tiny .xlsx: shared strings for text, plain numbers for the rest. */
const xlsx = (rows: Cell[][]) => {
  const strings: string[] = [];

  const sheet = rows
    .map((cells, index) => {
      const xml = cells
        .map((cell, column) => {
          const at = `${"BCDEFGH"[column]}${index + 1}`;

          if (cell === null) {
            return `<c r="${at}" s="4"/>`;
          }

          if ("number" in cell) {
            return `<c r="${at}" s="6"><v>${cell.number}</v></c>`;
          }

          strings.push(cell.text.replaceAll("&", "&amp;"));

          return `<c r="${at}" s="5" t="s"><v>${strings.length - 1}</v></c>`;
        })
        .join("");

      return `<row r="${index + 1}">${xml}</row>`;
    })
    .join("");

  return zipSync({
    "xl/sharedStrings.xml": strToU8(
      `<sst>${strings.map((text) => `<si><t>${text}</t></si>`).join("")}</sst>`
    ),
    "xl/worksheets/sheet1.xml": strToU8(
      `<worksheet><sheetData>${sheet}</sheetData></worksheet>`
    ),
  });
};

describe("readIllimity", () => {
  // 45_660 is 3 January 2025 in Excel's day count.
  const file = xlsx([
    [t("LE TUE OPERAZIONI dal 01/01/2025 al 05/01/2025")],
    [t("Rapporto:"), t("123 - Conto")],
    [t("Saldo disponibile al 05/01/2025"), t("+1.080,50 EUR")],
    [
      "Data operazione",
      "Tipologia",
      "Causale",
      "Stato",
      "Entrate",
      "Uscite",
      "Valuta",
    ].map(t),
    [
      n(45_662),
      t("Pagamento POS"),
      t("Shop"),
      t("In attesa"),
      null,
      n(9.5),
      t("EUR"),
    ],
    [
      n(45_661),
      t("Movimento conto"),
      t("REVOLUT**1234* Dublin"),
      t("Eseguito"),
      null,
      n(20),
      t("EUR"),
    ],
    [
      n(45_660),
      t("Bonifico Italia"),
      t("Rossi & Figli"),
      t("Eseguito"),
      n(110.1),
      null,
      t("EUR"),
    ],
  ]);

  test("lists the oldest row first, with the balance after each", () => {
    expect(readIllimity(file)).toEqual([
      {
        amount: 11_010,
        at: "2025-01-03",
        balance: 111_000,
        date: "2025-01-03",
        description: "Rossi & Figli",
        kind: "Bonifico Italia",
        settled: "2025-01-03",
      },
      {
        amount: -2000,
        at: "2025-01-04",
        balance: 109_000,
        date: "2025-01-04",
        description: "REVOLUT**1234* Dublin",
        kind: "Movimento conto",
        settled: "2025-01-04",
      },
    ]);
  });

  test("refuses a spreadsheet that is not a list of movements", () => {
    expect(() => readIllimity(xlsx([[t("Something else")]]))).toThrow(
      "not an illimity list of movements"
    );
  });
});

describe("backfill", () => {
  const result = backfill({
    accountId: "revolut",
    accounts,
    ledger,
    rows: readRevolut(statement),
  });

  test("starts after the last day the budget covers", () => {
    expect(result.since).toBe("2025-01-05");
    expect(result.transactions.map(({ date }) => date)).toEqual([
      "2025-01-08",
      "2025-01-09",
      "2025-01-09",
      "2025-01-12",
      "2025-01-12",
      "2025-01-05",
    ]);
  });

  test("skips a row the budget has, even when it settled later", () => {
    expect(result.transactions.map(({ amount }) => amount)).not.toContain(-500);
  });

  test("turns a known top-up into a transfer from the other account", () => {
    expect(result.transactions[0]).toMatchObject({
      amount: 2000,
      categoryId: null,
      payee: "Transfer from Illimity",
      transferAccountId: "illimity",
    });
  });

  test("gives a known payee its usual name and category", () => {
    expect(result.transactions[1]).toMatchObject({
      amount: -1250,
      categoryId: "eating-out",
      memo: "Bar Pino 0077",
      payee: "Pino",
    });
    expect(result.labelled).toBe(3);
  });

  test("leaves an unknown payee for the person to sort", () => {
    expect(result.transactions[4]).toMatchObject({
      categoryId: null,
      payee: "Cash at Bancomat",
    });
  });

  test("does not trust a habit it has seen only once", () => {
    expect(result.transactions[3]).toMatchObject({
      categoryId: null,
      memo: null,
      payee: "Old Shop",
    });
  });

  test("keeps two identical rows apart", () => {
    const ids = result.transactions.map(({ id }) => id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[1]).toBe("revolut-20250109120000--1250");
    expect(ids[2]).toBe("revolut-20250109120000--1250-2");
  });

  test("adds one adjustment so the balance matches the bank", () => {
    expect(result.adjustment).toBe(200);
    expect(result.transactions.at(-1)).toMatchObject({
      amount: 200,
      categoryId: "ready-to-assign",
      date: "2025-01-05",
      id: "revolut-adjustment-2025-01-05",
    });

    const balance = [
      ...ledger.filter(({ accountId }) => accountId === "revolut"),
      ...result.transactions,
    ].reduce((sum, { amount }) => sum + amount, 0);

    expect(balance).toBe(9300);
  });
});
