import type { Cents } from "@ynabe/budget";

/** One bank movement, as a sync service reports it. */
export interface BankRow {
  /** The service's own id. It never changes, so a row is never added twice. */
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  /** Who was paid or who paid, when the bank says. */
  payee: string;
  /** The bank's own words for the movement. */
  description: string;
  amount: Cents;
  /**
   * False while the bank still holds the payment as pending. A pending
   * row can change its amount, or vanish when the payment is cancelled.
   */
  booked: boolean;
}

/** The parts of a Synci transaction that the budget reads. */
export interface SynciTransaction {
  id: number | string;
  amount: string;
  currency: string;
  booked: boolean;
  booking_date: string;
  mapped_fields?: { payee?: string | null; description?: string | null } | null;
}

/**
 * Reads transactions from the Synci API. Card checks move no money, so
 * they are left out.
 */
export const readSynci = (
  transactions: readonly SynciTransaction[]
): BankRow[] =>
  transactions.flatMap((transaction, row): BankRow[] => {
    const amount = Math.round(Number(transaction.amount) * 100);

    if (amount === 0) {
      return [];
    }

    // The row number, not its contents: bank data is private.
    if (!Number.isInteger(amount)) {
      throw new TypeError(`Synci, row ${row + 1}: an amount is not a number`);
    }

    if (transaction.currency !== "EUR") {
      throw new Error(`Synci, row ${row + 1}: only euro rows are supported`);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/u.test(transaction.booking_date)) {
      throw new Error(`Synci, row ${row + 1}: a date is not like 2026-01-31`);
    }

    const description = transaction.mapped_fields?.description?.trim() ?? "";
    const payee = transaction.mapped_fields?.payee?.trim() ?? "";

    return [
      {
        amount,
        booked: transaction.booked,
        date: transaction.booking_date,
        description: description || payee,
        id: String(transaction.id),
        payee: payee || description,
      },
    ];
  });
