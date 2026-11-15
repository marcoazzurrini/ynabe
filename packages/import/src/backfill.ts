import { READY_TO_ASSIGN } from "@ynabe/budget";
import type { Cents } from "@ynabe/budget";

import { daysBetween } from "./days.ts";
import type { StatementRow } from "./statement.ts";
import type { ImportedAccount, ImportedTransaction } from "./ynab.ts";

export interface BackfillInput {
  /** The account the statement belongs to. */
  accountId: string;
  accounts: readonly ImportedAccount[];
  /** Every transaction already in the budget, for all accounts. */
  ledger: readonly ImportedTransaction[];
  /** The statement, in the order the bank settled it. */
  rows: readonly StatementRow[];
}

export interface Backfill {
  /** The last day the budget already covers for this account. */
  since: string;
  /** New rows to add: the statement after `since`, then the adjustment. */
  transactions: ImportedTransaction[];
  /** New rows that got a category or a transfer from past habits. */
  labelled: number;
  /** What the budget was off by on `since`. Zero adds no row. */
  adjustment: Cents;
}

/** How far apart the budget and the bank may date the same payment. */
const DAYS_APART = 5;

/** The same payee with a different order number is the same payee. */
const habitKey = ({ description, kind }: StatementRow) =>
  `${kind}|${description
    .toLowerCase()
    .replaceAll(/\d/gu, "#")
    .replaceAll(/[^a-z#]+/gu, " ")
    .trim()}`;

/** Pairs statement rows with budget rows of the same amount, nearest day first. */
const pair = (
  rows: readonly StatementRow[],
  own: readonly ImportedTransaction[]
) => {
  const free = new Map<Cents, ImportedTransaction[]>();

  for (const transaction of own) {
    free.set(transaction.amount, [
      ...(free.get(transaction.amount) ?? []),
      transaction,
    ]);
  }

  const pairs = new Map<StatementRow, ImportedTransaction>();

  for (const row of rows) {
    const [nearest] = (free.get(row.amount) ?? [])
      .filter(({ date }) => daysBetween(date, row.date) <= DAYS_APART)
      .toSorted(
        (a, b) => daysBetween(a.date, row.date) - daysBetween(b.date, row.date)
      );

    if (nearest) {
      pairs.set(row, nearest);
      free.set(
        row.amount,
        (free.get(row.amount) ?? []).filter((other) => other !== nearest)
      );
    }
  }

  return pairs;
};

type Habit = Pick<
  ImportedTransaction,
  "categoryId" | "payee" | "transferAccountId"
>;

/** What each kind of statement row usually became in the budget. */
const habitsFrom = (pairs: Map<StatementRow, ImportedTransaction>) => {
  const seen = new Map<string, Map<string, { count: number; habit: Habit }>>();

  for (const [row, { categoryId, payee, transferAccountId }] of pairs) {
    if (categoryId !== null || transferAccountId !== null) {
      const labels = seen.get(habitKey(row)) ?? new Map();
      const label = `${categoryId}|${transferAccountId}`;

      labels.set(label, {
        count: (labels.get(label)?.count ?? 0) + 1,
        habit: { categoryId, payee, transferAccountId },
      });
      seen.set(habitKey(row), labels);
    }
  }

  const habits = new Map<string, Habit>();

  for (const [key, labels] of seen) {
    const ranked = [...labels.values()].toSorted((a, b) => b.count - a.count);
    const total = ranked.reduce((sum, { count }) => sum + count, 0);
    const [first] = ranked;

    // Only a clear habit counts: seen at least twice, since one pair can
    // be two payments that happen to share an amount, and more than half
    // of the times.
    if (first && first.count >= 2 && first.count * 2 > total) {
      habits.set(key, first.habit);
    }
  }

  return habits;
};

/** An id that stays the same when the same statement is read again. */
const idsFor = (accountId: string) => {
  const used = new Map<string, number>();

  return (row: StatementRow): string => {
    const base = `${accountId}-${row.at.replaceAll(/\D/gu, "")}-${row.amount}`;
    const count = (used.get(base) ?? 0) + 1;

    used.set(base, count);

    return count === 1 ? base : `${base}-${count}`;
  };
};

/**
 * Continues an account from a bank statement. Rows the budget already has
 * are left alone, new rows take the category or transfer that the same
 * payee had before, and one adjustment makes the balance match the bank.
 */
export const backfill = ({
  accountId,
  accounts,
  ledger,
  rows,
}: BackfillInput): Backfill => {
  const own = ledger.filter(
    (transaction) => transaction.accountId === accountId
  );

  const since =
    own
      .map(({ date }) => date)
      .toSorted()
      .at(-1) ?? "";

  const pairs = pair(rows, own);
  const habits = habitsFrom(pairs);
  const idOf = idsFor(accountId);
  const nameOf = new Map(accounts.map(({ id, name }) => [id, name]));
  let labelled = 0;
  let added = 0;

  const transactions = rows.flatMap((row): ImportedTransaction[] => {
    // Ids count every row, so they do not shift when the budget grows.
    const id = idOf(row);

    if (row.settled <= since || pairs.has(row)) {
      return [];
    }

    const habit = habits.get(habitKey(row));
    const other = habit?.transferAccountId ?? null;
    let payee = habit?.payee ?? row.description;

    if (other) {
      payee = `Transfer ${row.amount < 0 ? "to" : "from"} ${nameOf.get(other) ?? other}`;
    }

    labelled += habit ? 1 : 0;
    added += row.amount;

    return [
      {
        accountId,
        amount: row.amount,
        categoryId: habit?.categoryId ?? null,
        cleared: "cleared",
        date: row.date,
        id,
        // Keep the bank's own words when the payee was renamed.
        memo: payee === row.description ? null : row.description,
        payee,
        transferAccountId: other,
      },
    ];
  });

  const before = own.reduce((sum, { amount }) => sum + amount, 0);
  const adjustment = (rows.at(-1)?.balance ?? before + added) - added - before;

  if (adjustment !== 0) {
    transactions.push({
      accountId,
      amount: adjustment,
      categoryId: READY_TO_ASSIGN,
      cleared: "reconciled",
      date: since,
      id: `${accountId}-adjustment-${since}`,
      memo: "Makes the balance match the bank statement",
      payee: "Reconciliation adjustment",
      transferAccountId: null,
    });
  }

  return { adjustment, labelled, since, transactions };
};
