import { READY_TO_ASSIGN } from "@ynabe/budget";
import type { Transaction } from "@ynabe/budget";

/** A transaction with everything the ledger shows. */
export interface LedgerEntry extends Transaction {
  accountId: string;
  payee: string;
  memo: string | null;
  cleared: "uncleared" | "cleared" | "reconciled";
  transferAccountId: string | null;
}

/** The budget as the Accounts screen needs it. */
export interface LedgerInput<Entry extends LedgerEntry = LedgerEntry> {
  accounts: readonly {
    id: string;
    name: string;
    kind: string;
    closed: boolean;
  }[];
  categories: readonly {
    id: string;
    name: string;
    groupId: string;
    icon: string | null;
  }[];
  groups: readonly { id: string; name: string }[];
  transactions: readonly Entry[];
}

/** A transaction joined with the names the ledger shows beside it. */
export type LedgerRow<Entry extends LedgerEntry = LedgerEntry> = Entry & {
  accountName: string;
  categoryName: string | null;
  categoryIcon: string | null;
  groupName: string | null;
  transferName: string | null;
  /** A likely category for a transaction that has none, from its payee. */
  guess: string | null;
  /** That category's id. */
  guessId: string | null;
};

/** True for a transaction that still has to be filed under a category. */
export const needsCategory = (row: LedgerEntry): boolean =>
  row.categoryId === null && !row.transferAccountId;

/** The category each payee is filed under most often. */
const usualCategories = (
  transactions: readonly LedgerEntry[]
): Map<string, string> => {
  const counts = new Map<string, Map<string, number>>();

  for (const { categoryId, payee } of transactions) {
    if (categoryId && categoryId !== READY_TO_ASSIGN) {
      const forPayee = counts.get(payee) ?? new Map<string, number>();

      forPayee.set(categoryId, (forPayee.get(categoryId) ?? 0) + 1);
      counts.set(payee, forPayee);
    }
  }

  const usual = new Map<string, string>();

  for (const [payee, forPayee] of counts) {
    const [best] = [...forPayee].toSorted((a, b) => b[1] - a[1]);

    if (best) {
      usual.set(payee, best[0]);
    }
  }

  return usual;
};

/** The category a payee is filed under most often, or null. */
export const usualCategory = (
  payee: string,
  transactions: readonly LedgerEntry[]
): string | null => usualCategories(transactions).get(payee.trim()) ?? null;

/** Joins transactions with account, category, and group names, plus a guess. */
export const ledgerRows = <Entry extends LedgerEntry>({
  accounts,
  categories,
  groups,
  transactions,
}: LedgerInput<Entry>): LedgerRow<Entry>[] => {
  const accountName = new Map(
    accounts.map((account) => [account.id, account.name])
  );

  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const byId = new Map(categories.map((category) => [category.id, category]));
  const usual = usualCategories(transactions);

  return transactions.map((row) => {
    const category = row.categoryId ? byId.get(row.categoryId) : undefined;
    const best = needsCategory(row) ? (usual.get(row.payee) ?? null) : null;
    const guess = best ? (byId.get(best) ?? null) : null;

    return {
      ...row,
      accountName: accountName.get(row.accountId) ?? "",
      categoryIcon: category?.icon ?? null,
      categoryName: category?.name ?? null,
      groupName: category ? (groupName.get(category.groupId) ?? null) : null,
      guess: guess?.name ?? null,
      guessId: guess?.id ?? null,
      transferName: row.transferAccountId
        ? (accountName.get(row.transferAccountId) ?? null)
        : null,
    };
  });
};

export type LedgerFilter = "all" | "uncleared" | "uncategorized" | "transfers";

/** Whether a row shows under a filter and a search, in lower case. */
export const inLedgerFilter = (
  row: LedgerRow,
  filter: LedgerFilter,
  search = ""
): boolean => {
  if (
    search !== "" &&
    !`${row.payee} ${row.memo ?? ""} ${row.categoryName ?? ""}`
      .toLowerCase()
      .includes(search)
  ) {
    return false;
  }

  if (filter === "uncleared") {
    return row.cleared === "uncleared";
  }

  if (filter === "uncategorized") {
    return needsCategory(row);
  }

  if (filter === "transfers") {
    return row.transferAccountId !== null;
  }

  return true;
};

export interface LedgerDay<Row extends LedgerRow = LedgerRow> {
  /** `YYYY-MM-DD` */
  date: string;
  /** What came in minus what went out that day. */
  total: number;
  rows: Row[];
}

/** Rows grouped by day, newest day first. */
export const ledgerDays = <Row extends LedgerRow>(
  rows: readonly Row[]
): LedgerDay<Row>[] => {
  const days = new Map<string, Row[]>();

  for (const row of rows) {
    days.set(row.date, [...(days.get(row.date) ?? []), row]);
  }

  return [...days]
    .toSorted(([a], [b]) => b.localeCompare(a))
    .map(([date, dayRows]) => ({
      date,
      rows: dayRows,
      total: dayRows.reduce((sum, row) => sum + row.amount, 0),
    }));
};

export interface AccountSummary {
  /** Undefined for the summary of every account. */
  id?: string;
  name: string;
  kind: string;
  balance: number;
  /** How many transactions the bank has not confirmed, and their sum. */
  uncleared: { count: number; sum: number };
}

const summarize = (
  rows: readonly LedgerEntry[],
  account: { id?: string; name: string; kind: string }
): AccountSummary => {
  const own = rows.filter(
    (row) => account.id === undefined || row.accountId === account.id
  );

  const uncleared = own.filter((row) => row.cleared === "uncleared");

  return {
    ...account,
    balance: own.reduce((sum, row) => sum + row.amount, 0),
    uncleared: {
      count: uncleared.length,
      sum: uncleared.reduce((sum, row) => sum + row.amount, 0),
    },
  };
};

/** The balance of every open account, with the total of all of them first. */
export const accountSummaries = ({
  accounts,
  transactions,
}: Pick<LedgerInput, "accounts" | "transactions">): AccountSummary[] => [
  summarize(transactions, { kind: "all", name: "All accounts" }),
  ...accounts
    .filter((account) => !account.closed)
    .map(({ id, kind, name }) => summarize(transactions, { id, kind, name })),
];
