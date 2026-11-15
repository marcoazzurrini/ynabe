import { daysBetween } from "./days.ts";
import type { ImportedAccount, ImportedTransaction } from "./ynab.ts";

export interface TransferInput {
  accounts: readonly ImportedAccount[];
  /** Rows already in the budget. They can pair up, but never change. */
  ledger: readonly ImportedTransaction[];
  /** New rows from every statement. */
  added: readonly ImportedTransaction[];
  /**
   * Keep a new transfer whose other side is missing. A bank feed can
   * bring the two sides days apart, so one missing side is not a wrong
   * guess yet.
   */
  keepUnpaired?: boolean;
}

export interface LinkedTransfers {
  /** The new rows, with the found other sides turned into transfers. */
  transactions: ImportedTransaction[];
  /** New rows that became the other side of a transfer. */
  linked: number;
  /**
   * New rows that looked like transfers but have no other side, although
   * the other account has a statement too. They go back to plain rows.
   */
  unpaired: number;
}

/** A bank can take a few days to show money another bank has sent. */
const DAYS_APART = 3;

/**
 * Makes transfers whole. Each statement only knows its own account, so
 * one side of a transfer can come out as plain spending or income. A new
 * row with no category that mirrors a transfer in the other account,
 * the same amount a few days apart, becomes that transfer's other side.
 *
 * A new transfer that still has no other side, when the other account
 * has a statement too, was a wrong guess: it goes back to a plain row,
 * so money cannot appear or vanish between two accounts unseen.
 */
export const linkTransfers = ({
  accounts,
  added,
  keepUnpaired = false,
  ledger,
}: TransferInput): LinkedTransfers => {
  const nameOf = new Map(accounts.map(({ id, name }) => [id, name]));
  const used = new Set<ImportedTransaction>();
  const turned = new Map<ImportedTransaction, ImportedTransaction>();
  const all = [...ledger, ...added];
  const fresh = new Set(added);
  const covered = new Set(added.map(({ accountId }) => accountId));
  const sides = all.filter((row) => row.transferAccountId !== null);

  /** The nearest free row in the other account that mirrors this side. */
  const mirrorOf = (
    side: ImportedTransaction,
    candidates: readonly ImportedTransaction[]
  ) =>
    candidates
      .filter(
        (row) =>
          !used.has(row) &&
          row.accountId === side.transferAccountId &&
          row.amount === -side.amount &&
          daysBetween(row.date, side.date) <= DAYS_APART
      )
      .toSorted(
        (a, b) =>
          daysBetween(a.date, side.date) - daysBetween(b.date, side.date)
      )
      .at(0);

  // First the transfers that already have both sides.
  for (const side of sides) {
    const other = used.has(side)
      ? undefined
      : mirrorOf(
          side,
          sides.filter((row) => row.transferAccountId === side.accountId)
        );

    if (other) {
      used.add(side).add(other);
    }
  }

  const plain = added.filter(
    (row) => row.categoryId === null && row.transferAccountId === null
  );

  for (const side of sides.filter((row) => !used.has(row))) {
    const other = mirrorOf(side, plain);

    if (other) {
      used.add(side).add(other);
      turned.set(other, {
        ...other,
        memo: other.memo ?? other.payee,
        payee: `Transfer ${other.amount < 0 ? "to" : "from"} ${nameOf.get(side.accountId) ?? side.accountId}`,
        transferAccountId: side.accountId,
      });
    }
  }

  const linked = turned.size;

  const wrong = sides.filter(
    (row) =>
      !keepUnpaired &&
      !used.has(row) &&
      fresh.has(row) &&
      covered.has(row.transferAccountId ?? "")
  );

  for (const side of wrong) {
    turned.set(side, {
      ...side,
      memo: null,
      payee: side.memo ?? side.payee,
      transferAccountId: null,
    });
  }

  return {
    linked,
    transactions: added.map((row) => turned.get(row) ?? row),
    unpaired: wrong.length,
  };
};
