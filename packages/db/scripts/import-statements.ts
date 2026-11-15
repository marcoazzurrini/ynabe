/**
 * Continues the accounts from bank statements, after the YNAB import.
 * Put each statement in imports/statements/<account>, run
 * `bun run --cwd packages/db import:statements`, then load the result
 * with `bun run --cwd apps/web db:import statements.sql`. Rows already
 * loaded are skipped, so newer statements can be run again.
 *
 * imports/setup.json, when it is there, holds the person's own choices:
 * new categories, which category a payee belongs in, and whether to
 * budget the months since YNAB from savings.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatMoney, planMonth, READY_TO_ASSIGN } from "@ynabe/budget";
import type { Month } from "@ynabe/budget";
import {
  applyRules,
  backfill,
  linkTransfers,
  readIllimity,
  readRevolut,
  readYnab,
  replayMonths,
} from "@ynabe/import";
import type { Rule } from "@ynabe/import";

const text = (value: string | null) =>
  value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`;

const imports = fileURLToPath(new URL("../../../imports", import.meta.url));
const statements = path.join(imports, "statements");

/** Opens the file in a folder whose name ends a certain way, the last by name. */
const find = async (folder: string, ending: string) => {
  const names = await readdir(folder);

  const name = names
    .filter((file) => file.endsWith(ending))
    .toSorted()
    .at(-1);

  if (!name) {
    throw new Error(`No file ending in "${ending}" in ${folder}`);
  }

  return Bun.file(path.join(folder, name));
};

// Each bank writes its statement its own way.
const readers = new Map([
  [
    "illimity",
    async (folder: string) => {
      const file = await find(folder, ".xlsx");

      return readIllimity(await file.bytes());
    },
  ],
  [
    "revolut",
    async (folder: string) => {
      const file = await find(folder, ".csv");

      return readRevolut(await file.text());
    },
  ],
]);

const ynab = path.join(imports, "ynab");
const register = await find(ynab, "Register.csv");
const plan = await find(ynab, "Plan.csv");
const budget = readYnab(await register.text(), await plan.text());
const folders = await readdir(statements);

const results = await Promise.all(
  folders.toSorted().map(async (accountId) => {
    const reader = readers.get(accountId);

    if (!reader) {
      return [];
    }

    return [
      backfill({
        accountId,
        accounts: budget.accounts,
        ledger: budget.transactions,
        rows: await reader(path.join(statements, accountId)),
      }),
    ];
  })
);

const backfills = results.flat();
const added = backfills.flatMap((result) => result.transactions);

const report = backfills.map(
  (result) =>
    `${result.transactions[0]?.accountId}: covered up to ${result.since}, off by ${formatMoney(result.adjustment, { sign: true })} that day`
);

const paired = linkTransfers({
  accounts: budget.accounts,
  added,
  ledger: budget.transactions,
});

/**
 * Choices only the person can make, kept beside the statements in
 * imports/setup.json. Every part is optional.
 */
interface Setup {
  /** Accounts that no longer exist. They keep their history. */
  closed?: string[];
  /** Categories YNAB did not have. A new group name makes a new group. */
  categories?: { id: string; group: string; name: string }[];
  /** Which category a payee belongs in. A rule beats a past habit. */
  rules?: Rule[];
  /** Budget the months since YNAB, taking what is missing from savings. */
  replay?: { until: Month; drawFrom: string[] };
}

const setupFile = Bun.file(path.join(imports, "setup.json"));
const setup: Setup = (await setupFile.exists()) ? await setupFile.json() : {};
const groupIds = new Map(budget.groups.map(({ id, name }) => [name, id]));
const newGroups = new Map<string, string>();
const sizes = new Map<string, number>();

for (const { groupId } of budget.categories) {
  sizes.set(groupId, (sizes.get(groupId) ?? 0) + 1);
}

const newCategories = (setup.categories ?? []).map(({ group, id, name }) => {
  const made = group.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-");
  const groupId = groupIds.get(group) ?? made;
  const position = sizes.get(groupId) ?? 0;

  if (!groupIds.has(group)) {
    newGroups.set(groupId, group);
  }

  sizes.set(groupId, position + 1);

  return { groupId, id, name, position };
});

const categories = [...budget.categories, ...newCategories];
const known = new Set(categories.map(({ id }) => id));
const rules = setup.rules ?? [];

const unknown = [
  ...rules.map(({ category }) => category),
  ...(setup.replay?.drawFrom ?? []),
].filter((id) => id !== READY_TO_ASSIGN && !known.has(id));

if (unknown.length > 0) {
  throw new Error(`setup.json names unknown categories: ${unknown.join(", ")}`);
}

const closed = setup.closed ?? [];
const accountIds = new Set(budget.accounts.map(({ id }) => id));
const strangers = closed.filter((id) => !accountIds.has(id));

if (strangers.length > 0) {
  throw new Error(
    `setup.json closes unknown accounts: ${strangers.join(", ")}`
  );
}

const ruled = applyRules(paired.transactions, rules);
const linked = { ...paired, transactions: ruled.transactions };

const data = {
  assignments: budget.assignments,
  categories,
  transactions: [...budget.transactions, ...linked.transactions].map((row) => ({
    ...row,
    transfer: row.transferAccountId !== null,
  })),
};

const replay = setup.replay
  ? replayMonths({ data, ...setup.replay })
  : { assignments: [], drawn: [], short: 0 };

const lines = [
  "-- Generated by scripts/import-statements.ts. Adds rows, replaces none.",
  ...closed.map(
    (id) => `UPDATE accounts SET closed = 1 WHERE id = ${text(id)};`
  ),
  ...[...newGroups].map(
    ([id, name], index) =>
      `INSERT OR IGNORE INTO category_groups (id, name, position) VALUES (${text(id)}, ${text(name)}, ${budget.groups.length + index});`
  ),
  ...newCategories.map(
    ({ groupId, id, name, position }) =>
      `INSERT OR IGNORE INTO categories (id, group_id, name, position) VALUES (${text(id)}, ${text(groupId)}, ${text(name)}, ${position});`
  ),
  ...linked.transactions.map(
    (row) =>
      `INSERT OR IGNORE INTO transactions (id, account_id, date, payee, memo, amount, category_id, cleared, transfer_account_id) VALUES (${[
        text(row.id),
        text(row.accountId),
        text(row.date),
        text(row.payee),
        text(row.memo),
        row.amount,
        text(row.categoryId),
        text(row.cleared),
        text(row.transferAccountId),
      ].join(", ")});`
  ),
  ...replay.assignments.map(
    ({ amount, categoryId, month }) =>
      `INSERT OR IGNORE INTO assignments (category_id, month, amount) VALUES (${text(categoryId)}, ${text(month)}, ${amount});`
  ),
];

const output = path.join(imports, "statements.sql");

await Bun.write(output, `${lines.join("\n")}\n`);

const transfers = linked.transactions.filter(
  (row) => row.transferAccountId !== null
);

const adjustments = backfills.filter((result) => result.adjustment !== 0);
const filed = linked.transactions.filter((row) => row.categoryId !== null);
const dates = linked.transactions.map(({ date }) => date).toSorted();
const nameOf = new Map(categories.map(({ id, name }) => [id, name]));

const replayed = setup.replay
  ? [
      `Replayed up to ${setup.replay.until}: ${replay.assignments.length} assignments`,
      ...replay.drawn.map(
        ({ amount, categoryId }) =>
          `  taken from ${nameOf.get(categoryId)}: ${formatMoney(amount)}`
      ),
      `  still missing: ${formatMoney(replay.short)}`,
      `  ready to assign in ${setup.replay.until}: ${formatMoney(
        planMonth(
          {
            ...data,
            assignments: [...data.assignments, ...replay.assignments],
          },
          setup.replay.until
        ).readyToAssign
      )}`,
    ]
  : [];

// Counts and totals only: the terminal should not show private rows.
console.log(
  [
    ...report,
    `New transactions: ${linked.transactions.length} (${dates[0]} to ${dates.at(-1)})`,
    `With a category from past habits: ${filed.length - adjustments.length - ruled.filed}`,
    `With a category from setup.json rules: ${ruled.filed}`,
    `Transfers between your accounts: ${transfers.length} (${linked.linked} found by their other side)`,
    `Looked like transfers but had no other side: ${linked.unpaired}`,
    `Left to categorize: ${linked.transactions.length - filed.length - transfers.length}`,
    ...replayed,
    `Wrote ${path.relative(process.cwd(), output)}`,
  ].join("\n")
);
