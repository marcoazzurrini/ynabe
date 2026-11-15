import { parseMoney } from "@ynabe/budget";
import type { Cents } from "@ynabe/budget";

import { parseCsv } from "./csv.ts";
import { excelDate, readSheet } from "./xlsx.ts";

/** One settled line of a bank statement, the same for every bank. */
export interface StatementRow {
  /** When the payment was made, `YYYY-MM-DD`. */
  date: string;
  /** When the bank settled it, `YYYY-MM-DD`. Balances follow this order. */
  settled: string;
  /** The moment it was made, as exactly as the bank says. Part of the row's id. */
  at: string;
  /** The bank's word for the kind of movement, like `Card Payment`. */
  kind: string;
  description: string;
  /** What it did to the balance, fees included. */
  amount: Cents;
  /** The account balance after this row. */
  balance: Cents;
}

const fail = (row: number, problem: string): never => {
  // The row number, not its contents: statements hold private data.
  throw new Error(`Statement, row ${row + 2}: ${problem}`);
};

const money = (value: string, row: number): Cents =>
  parseMoney(value) ?? fail(row, "an amount is not a number");

/**
 * Reads a Revolut account statement CSV. Reverted and pending rows never
 * moved the balance, so they are left out.
 */
export const readRevolut = (csv: string): StatementRow[] =>
  parseCsv(csv).flatMap((line, row): StatementRow[] => {
    if (line.State !== "COMPLETED") {
      return [];
    }

    if (line.Currency !== "EUR") {
      return fail(row, "only euro statements are supported");
    }

    const at = line["Started Date"] ?? "";
    const settled = (line["Completed Date"] ?? "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2} /u.test(at) || settled.length !== 10) {
      return fail(row, "a date is not like `2026-01-31 12:00:00`");
    }

    return [
      {
        amount: money(line.Amount ?? "", row) - money(line.Fee ?? "", row),
        at,
        balance: money(line.Balance ?? "", row),
        date: at.slice(0, 10),
        description: line.Description ?? "",
        kind: line.Type ?? "",
        settled,
      },
    ];
  });

const ILLIMITY_COLUMNS = [
  "Data operazione",
  "Tipologia",
  "Causale",
  "Stato",
  "Entrate",
  "Uscite",
  "Valuta",
];

/**
 * Reads an illimity "lista movimenti" spreadsheet. It lists the newest
 * row first and gives one balance, the available one, at the top; the
 * balance after each row is worked back from that. Rows still waiting
 * (`In attesa`) are left out, and their amounts are put back into the
 * balance, since the available balance already counts them.
 */
export const readIllimity = (file: Uint8Array): StatementRow[] => {
  const sheet = readSheet(file);

  const header = sheet.findIndex((cells) =>
    ILLIMITY_COLUMNS.every((name) => Object.values(cells).includes(name))
  );

  const columns = new Map(
    Object.entries(sheet[header] ?? {}).map(([column, name]) => [name, column])
  );

  const closing = sheet
    .slice(0, Math.max(header, 0))
    .flatMap((cells) => Object.values(cells))
    .map((cell) => /^(?<amount>[+-][\d.,]+) EUR$/u.exec(String(cell)))
    .find((match) => match !== null)?.groups?.amount;

  let balance = parseMoney((closing ?? "").replace("+", ""));

  if (header === -1 || balance === null) {
    throw new Error("Statement: not an illimity list of movements in euro");
  }

  // Newest first, so walk down the sheet taking each row off the balance.
  return sheet
    .slice(header + 1)
    .flatMap((cells, row): StatementRow[] => {
      const cell = (name: string) => cells[columns.get(name) ?? ""];
      const day = Number(cell("Data operazione"));

      const amount = Math.round(
        (Number(cell("Entrate") ?? 0) - Number(cell("Uscite") ?? 0)) * 100
      );

      if (!Number.isFinite(day) || !Number.isInteger(amount)) {
        return fail(row + header, "a date or an amount is not a number");
      }

      if (cell("Valuta") !== "EUR") {
        return fail(row + header, "only euro statements are supported");
      }

      const after = balance ?? 0;

      balance = after - amount;

      if (cell("Stato") !== "Eseguito") {
        return [];
      }

      const date = excelDate(day);

      return [
        {
          amount,
          at: date,
          balance: after,
          date,
          description: String(cell("Causale") ?? ""),
          kind: String(cell("Tipologia") ?? ""),
          settled: date,
        },
      ];
    })
    .toReversed();
};
