# ynabe

A calm, AI-assisted envelope budgeting app, in the spirit of YNAB.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | TanStack Start app on Cloudflare Workers, with D1, TanStack DB and Charts |
| `apps/demo` | Storybook for the design system |
| `packages/budget` | The budget engine: one month of the budget from categories and money |
| `packages/reports` | Spending insights for Reflect: pace, day levels, usual ranges |
| `packages/import` | Reads a YNAB export into the rows ynabe stores |
| `packages/db` | Drizzle schema, D1 migrations, and budget storage |
| `packages/ui` | Design tokens and components: Tailwind v4, shadcn on Base UI |
| `.penna/` | The design: foundations, components, patterns, and screens (open in penna) |

`packages/budget`, `packages/reports`, and `packages/db` are deep modules: a small interface (`planMonth`, `spendingReport`, `loadBudget`) over the rules behind it.

## Getting started

```sh
bun install
bun run --cwd apps/web db:migrate   # create the local D1 tables
bun run --cwd apps/web db:seed      # fill them with sample data
bun run dev                         # the app on http://localhost:3000
bun run storybook                   # Storybook on http://localhost:6006
```

## Importing from YNAB

In YNAB, choose Export Plan and unzip the download into `imports/ynab`. Git ignores `imports/`, so the files stay on this machine.

```sh
bun run --cwd packages/db import:ynab       # write imports/ynab.sql and check it
bun run --cwd apps/web db:import ynab.sql   # replace the local budget with it
```

The first command prints counts and says whether every category balance matches what YNAB showed. The import replaces the whole budget. Targets, account types, and icons are not in the export.

### Continuing from bank statements

YNAB history usually stops before today. To fill the gap, put each bank's statement in `imports/statements/<account>`, where `<account>` is the account's id: a Revolut account statement CSV in `revolut`, an illimity "lista movimenti" spreadsheet in `illimity`.

```sh
bun run --cwd packages/db import:statements         # write imports/statements.sql
bun run --cwd apps/web db:import statements.sql     # add the rows to the local budget
```

For each account this adds the statement rows after the last day YNAB covers:

- A row takes the payee name, category, or transfer that the same bank text had in YNAB. The bank's own text stays in the memo.
- A transfer needs both sides. A plain row that mirrors a transfer in the other account becomes its other side, and a guessed transfer with no other side goes back to a plain row.
- One adjustment per account makes the balance match the bank on the last day YNAB covers.
- The rest wait in Accounts for a category.

Running it again with newer statements only adds the new rows, and leaves the rows already loaded as they are.

`imports/setup.json`, when it is there, holds the choices only you can make. Every part is optional:

- `closed`: ids of accounts that no longer exist. They keep their history and leave the open list.
- `categories`: categories YNAB did not have, as `{ id, group, name }`. A new group name makes a new group.
- `rules`: which category a payee belongs in, as `{ category, payees, contains, only }`: whole payee names, pieces of the bank's text, and `in` or `out` to limit a rule to money coming in or going out. A rule beats a habit from YNAB.
- `replay`: budgets the months since YNAB, as `{ until, drawFrom }`. Each month, every category that spent more than it held gets the difference, and when that is more than the month had, the money comes out of the `drawFrom` categories in order. Remove it once you budget in the app.

## Syncing with the banks

The app can fetch new bank rows by itself through [Synci](https://synci.io), a paid service that reads European banks over open banking. It needs a Synci account with the banks connected, and a personal access token that can only read accounts, transactions, and connections.

1. Put the token in `apps/web/.dev.vars` as `SYNCI_API_TOKEN`, and set it on the deployed Worker with `wrangler secret put SYNCI_API_TOKEN`.
2. Tie each Synci account to a budget account with one row in `bank_links`: the Synci account id as `source_id`, the budget account as `account_id`, and `since`, the first day the sync may add rows for. Keep that SQL in `imports/`, since it is private, and load it with `bun run --cwd apps/web db:import <file>`.

The Worker then syncs every six hours, and **Sync banks** on the Accounts screen does it at once. A bank row the budget already holds, from a statement or typed in, is tied to it instead of added again, so the statements and the sync can overlap. A new row takes the category or transfer that the same bank words had before. A pending payment comes in uncleared. It turns cleared, with the final amount, when the bank books it, and it is removed when the bank drops it, since the payment was then cancelled.

## Checks

`bun run check` runs formatting, lint (oxlint with Ultracite and anti-slop), types, tests, and builds. Lefthook formats and lints staged files before each commit and runs the full check on a clean copy before each push.

`main` is protected: changes land through pull requests once CI passes.

## Deploying

The app runs on Cloudflare Workers at <https://ynabe.marco-azzurrini-art.workers.dev>, with its data in the `ynabe` D1 database (Western Europe).

```sh
bun run --cwd apps/web db:migrate:remote   # apply new migrations first
bun run --cwd apps/web deploy              # build and deploy the Worker
```

Only `marco.azzurrini.art@gmail.com` can sign in, in two steps: Google, then a passkey. The first time, the app asks to create the passkey; after that, every new browser has to show it. Both steps last 30 days. Every server function answers 401 until both are passed, so the browser shell is all a stranger can load. Locally, copy `apps/web/.dev.vars.example` to `apps/web/.dev.vars` and fill in the values; the Google client lives in the `ynabe` Google Cloud project.

If the passkey is lost, remove it and create a new one at the next sign-in:

```sh
cd apps/web && bunx wrangler d1 execute ynabe --remote --command "DELETE FROM passkeys; DELETE FROM second_steps;"
```
