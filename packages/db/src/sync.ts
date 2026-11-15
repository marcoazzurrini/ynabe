import { linkTransfers, readSynci, sync } from "@ynabe/import";
import type { BankRow, SyncedTransaction } from "@ynabe/import";
import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "./budget.ts";
import * as schema from "./schema.ts";

export type BankLink = typeof schema.bankLinks.$inferSelect;

/** Fetches the bank rows of one linked account. */
export type BankFeed = (link: BankLink) => Promise<BankRow[]>;

export interface SyncReport {
  /** Bank rows that became new transactions. */
  added: number;
  /** Transactions that were already there and are now tied to a bank row. */
  claimed: number;
  /** New transactions that got a category or a transfer from past habits. */
  labelled: number;
  /** Pending transactions the bank has since booked or changed. */
  settled: number;
  /** Pending transactions removed because the payment was cancelled. */
  removed: number;
}

const SYNCI = "https://api.synci.io/api/v1/finance/transactions";
const PAGE_SIZE = 100;

const synciPage = z.object({
  data: z.array(
    z.object({
      amount: z.string(),
      booked: z.boolean(),
      booking_date: z.string(),
      currency: z.string(),
      id: z.union([z.number(), z.string()]),
      mapped_fields: z
        .object({
          description: z.string().nullish(),
          payee: z.string().nullish(),
        })
        .nullish(),
    })
  ),
  meta: z.object({ last_page: z.number().int() }),
});

/** The part of `fetch` the feed uses, so a test can stand in for it. */
export type Fetcher = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/** A feed that reads transactions, pending ones too, from the Synci API. */
export const synciFeed =
  (token: string, fetcher: Fetcher = fetch): BankFeed =>
  async ({ sourceId }) => {
    const page = async (number: number) => {
      const query = new URLSearchParams({
        "filter[financial_account_id]": sourceId,
        omit_sensitive_identifiers: "true",
        "page[number]": String(number),
        "page[size]": String(PAGE_SIZE),
      });

      const response = await fetcher(`${SYNCI}?${query}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // The status only: the answer can hold private bank data.
        throw new Error(`Synci answered ${response.status}`);
      }

      return synciPage.parse(JSON.parse(await response.text()));
    };

    const first = await page(1);

    const rest = await Promise.all(
      Array.from(
        { length: Math.max(first.meta.last_page - 1, 0) },
        (_, index) => page(index + 2)
      )
    );

    return readSynci([first, ...rest].flatMap(({ data }) => data));
  };

/** Rows per insert, so one statement stays under D1's 100 values. */
const CHUNK = 9;

/**
 * Brings every linked account up to date from its bank feed. Rows the
 * budget already holds are only tied to their bank row, so running it
 * again adds nothing twice.
 */
export const syncBanks = async (
  db: Database,
  feed: BankFeed
): Promise<SyncReport> => {
  const [links, accounts, ledger] = await Promise.all([
    db.select().from(schema.bankLinks),
    db.select().from(schema.accounts),
    db.select().from(schema.transactions),
  ]);

  const feeds = await Promise.all(
    links.map(async (link) => ({ link, rows: await feed(link) }))
  );

  const results = feeds.map(({ link, rows }) =>
    sync({
      accountId: link.accountId,
      accounts,
      ledger,
      rows,
      since: link.since,
    })
  );

  const fresh = results.flatMap(({ added }) => added);
  const sourceOf = new Map(fresh.map(({ id, sourceId }) => [id, sourceId]));

  const { transactions } = linkTransfers({
    accounts,
    added: fresh,
    keepUnpaired: true,
    ledger,
  });

  const added: SyncedTransaction[] = transactions.map((row) => ({
    ...row,
    sourceId: sourceOf.get(row.id) ?? null,
  }));

  const claimed = results.flatMap((result) => result.claimed);
  const settled = results.flatMap((result) => result.settled);
  const removed = results.flatMap((result) => result.removed);

  const chunks = Array.from(
    { length: Math.ceil(added.length / CHUNK) },
    (_, index) => added.slice(index * CHUNK, (index + 1) * CHUNK)
  );

  await Promise.all([
    ...chunks.map((rows) =>
      db.insert(schema.transactions).values(rows).onConflictDoNothing()
    ),
    ...claimed.map(({ id, memo, sourceId }) =>
      db
        .update(schema.transactions)
        .set({ memo, sourceId })
        .where(eq(schema.transactions.id, id))
    ),
    ...settled.map(({ id, ...bank }) =>
      db
        .update(schema.transactions)
        .set(bank)
        .where(eq(schema.transactions.id, id))
    ),
    ...removed.map((id) =>
      db.delete(schema.transactions).where(eq(schema.transactions.id, id))
    ),
  ]);

  return {
    added: added.length,
    claimed: claimed.length,
    labelled: results.reduce((sum, { labelled }) => sum + labelled, 0),
    removed: removed.length,
    settled: settled.length,
  };
};
