import type { Cents } from "@ynabe/budget";

import { daysBetween } from "./days.ts";
import type { BankRow } from "./synci.ts";
import type { ImportedAccount, ImportedTransaction } from "./ynab.ts";

/** A budget row that may already be tied to a bank row. */
export interface SyncedTransaction extends ImportedTransaction {
  /** The bank row's id, or null for a row the bank did not send. */
  sourceId: string | null;
}

export interface SyncInput {
  /** The account the bank rows belong to. */
  accountId: string;
  accounts: readonly ImportedAccount[];
  /** Every transaction already in the budget, for all accounts. */
  ledger: readonly SyncedTransaction[];
  /**
   * Bank rows before this day are never added: statements cover them.
   * They are still tied to the rows the budget holds.
   */
  since: string;
  rows: readonly BankRow[];
}

export interface Sync {
  /** Bank rows the budget did not have yet. */
  added: SyncedTransaction[];
  /**
   * Budget rows that turned out to be a bank row, now tied to it. The
   * memo takes the bank's words when it was empty, so the next row with
   * those words is filed the same way.
   */
  claimed: { id: string; memo: string | null; sourceId: string }[];
  /**
   * Pending rows the budget holds that the bank has since booked or
   * changed. They take the bank's amount, day, and state.
   */
  settled: {
    id: string;
    amount: Cents;
    cleared: "uncleared" | "cleared";
    date: string;
    sourceId: string;
  }[];
  /** Pending rows the bank dropped: the payment was cancelled. */
  removed: string[];
  /** New rows that got a category or a transfer from past habits. */
  labelled: number;
}

/** How far apart the budget and the bank may date the same payment. */
const DAYS_APART = 5;

/** The same payee with a different order number is the same payee. */
const habitKey = (words: string) =>
  words
    .toLowerCase()
    .replaceAll(/\d/gu, "#")
    .replaceAll(/[^a-z#]+/gu, " ")
    .trim();

type Habit = Pick<
  ImportedTransaction,
  "categoryId" | "payee" | "transferAccountId"
>;

/** What the bank's words for a payment usually became in this account. */
const habitsFrom = (own: readonly SyncedTransaction[]) => {
  const seen = new Map<string, Map<string, { count: number; habit: Habit }>>();

  for (const { categoryId, memo, payee, transferAccountId } of own) {
    if (categoryId !== null || transferAccountId !== null) {
      // The memo keeps the bank's words when the payee was renamed.
      const key = habitKey(memo ?? payee);
      const labels = seen.get(key) ?? new Map();
      const label = `${categoryId}|${transferAccountId}`;

      labels.set(label, {
        count: (labels.get(label)?.count ?? 0) + 1,
        habit: { categoryId, payee, transferAccountId },
      });
      seen.set(key, labels);
    }
  }

  const habits = new Map<string, Habit>();

  for (const [key, labels] of seen) {
    const ranked = [...labels.values()].toSorted((a, b) => b.count - a.count);
    const total = ranked.reduce((sum, { count }) => sum + count, 0);
    const [first] = ranked;

    // Only a clear habit counts: seen at least twice, and more than half
    // of the times.
    if (first && first.count >= 2 && first.count * 2 > total) {
      habits.set(key, first.habit);
    }
  }

  return habits;
};

const stateOf = ({ booked }: BankRow) => (booked ? "cleared" : "uncleared");

/**
 * Continues an account from its bank feed. A bank row the budget already
 * holds, by id or as the same amount a few days apart, is only tied to
 * that row. A new one takes the category or transfer that the same
 * words had before.
 *
 * A pending payment comes in uncleared. When the bank books it, the row
 * turns cleared and takes the final amount. When the bank drops it, the
 * payment was cancelled and the row goes, unless a new bank row of the
 * same amount takes its place: some banks give a booked payment a new id.
 */
export const sync = ({
  accountId,
  accounts,
  ledger,
  rows,
  since,
}: SyncInput): Sync => {
  const own = ledger.filter((row) => row.accountId === accountId);
  const known = new Set(ledger.map(({ sourceId }) => sourceId));
  const fed = new Map(rows.map((row) => [row.id, row]));
  const oldest = rows.map(({ date }) => date).toSorted()[0] ?? "";
  const pending = own.filter(({ cleared }) => cleared === "uncleared");

  const settled: Sync["settled"] = pending.flatMap((held) => {
    const row = fed.get(held.sourceId ?? "");

    return row &&
      (row.booked || row.amount !== held.amount || row.date !== held.date)
      ? [
          {
            amount: row.amount,
            cleared: stateOf(row),
            date: row.date,
            id: held.id,
            sourceId: row.id,
          },
        ]
      : [];
  });

  // Only rows the sync made itself, and only where the feed reaches: an
  // empty or short feed is no proof that a payment was cancelled.
  const dropped = new Set(
    pending.filter(
      ({ date, id, sourceId }) =>
        sourceId !== null &&
        !fed.has(sourceId) &&
        id.startsWith("bank-") &&
        oldest !== "" &&
        date >= oldest
    )
  );

  const free = own.filter((row) => row.sourceId === null || dropped.has(row));

  const taken = new Map<SyncedTransaction, BankRow>();
  const nameOf = new Map(accounts.map(({ id, name }) => [id, name]));

  const fresh = rows
    .filter(({ id }) => !known.has(id))
    .toSorted((a, b) => a.date.localeCompare(b.date));

  const tied = new Set<BankRow>();

  // Nearest days first, for every row, before any looser match. Equal
  // amounts repeat, and taking them in date order alone would hand a
  // row's true partner to its neighbour.
  for (let apart = 0; apart <= DAYS_APART; apart += 1) {
    for (const row of fresh) {
      const same = tied.has(row)
        ? undefined
        : free.find(
            (other) =>
              !taken.has(other) &&
              other.amount === row.amount &&
              daysBetween(other.date, row.date) === apart
          );

      if (same) {
        taken.set(same, row);
        tied.add(row);
      }
    }
  }

  const unheld = fresh.filter((row) => !tied.has(row));

  const claimed = [...taken].flatMap(([held, row]) =>
    dropped.has(held)
      ? []
      : [
          {
            id: held.id,
            memo:
              held.memo ??
              (held.payee === row.description ? null : row.description),
            sourceId: row.id,
          },
        ]
  );

  // A dropped pending row whose payment came back under a new id.
  for (const [held, row] of taken) {
    if (dropped.has(held)) {
      settled.push({
        amount: row.amount,
        cleared: stateOf(row),
        date: row.date,
        id: held.id,
        sourceId: row.id,
      });
    }
  }

  const removed = [...dropped].flatMap((held) =>
    taken.has(held) ? [] : [held.id]
  );

  const memoOf = new Map(claimed.map(({ id, memo }) => [id, memo]));

  // Learn from the rows as they are after tying, bank words included.
  const habits = habitsFrom(
    own.map((row) => ({ ...row, memo: memoOf.get(row.id) ?? row.memo }))
  );

  let labelled = 0;

  const added = unheld
    .filter(({ date }) => date >= since)
    .map((row): SyncedTransaction => {
      const habit =
        habits.get(habitKey(row.description)) ??
        habits.get(habitKey(row.payee));

      const other = habit?.transferAccountId ?? null;
      let payee = habit?.payee ?? row.payee;

      if (other) {
        payee = `Transfer ${row.amount < 0 ? "to" : "from"} ${nameOf.get(other) ?? other}`;
      }

      labelled += habit ? 1 : 0;

      return {
        accountId,
        amount: row.amount,
        categoryId: habit?.categoryId ?? null,
        cleared: stateOf(row),
        date: row.date,
        id: `bank-${row.id}`,
        // Keep the bank's own words when the payee was renamed.
        memo: payee === row.description ? null : row.description,
        payee,
        sourceId: row.id,
        transferAccountId: other,
      };
    });

  return { added, claimed, labelled, removed, settled };
};
