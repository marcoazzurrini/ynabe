# ynabe

A calm, AI-assisted envelope budgeting app, in the spirit of YNAB.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | TanStack Start app on Cloudflare Workers, with D1, TanStack DB and Charts |
| `apps/agent` | The assistant's runner: Claude Code behind a small server, on an always-on Mac |
| `apps/demo` | Storybook for the design system |
| `packages/agent` | The assistant: its tools, its prompt, and one run from question to answer |
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

## The assistant

Ledger, the assistant in the right-hand panel, is one conversation that never ends. It answers questions from the budget, and it suggests changes: filing transactions under categories, assigning money, and setting targets. A suggestion shows up as a proposal, and nothing changes until you apply it. After a bank sync brings new rows, the assistant looks at them by itself and leaves a note in the conversation.

It runs on a Claude subscription, through Claude Code and the Claude Agent SDK, so it draws from the same allowance as Claude Code. Anthropic allows this for personal use. Serving other people from one subscription is not allowed.

How a run works:

1. The Worker builds the prompt from D1: the assistant's notes, a summary of the older conversation, the recent messages, and the new one.
2. The Worker sends it to the runner (`apps/agent`), which hands it to Claude Code. Claude Code has no files, shell, or web access, only the budget tools.
3. Claude Code calls the tools on the Worker, at `/api/agent/mcp`, with a pass that is good for that one run.
4. The answer streams to the panel and is stored in D1. The runner keeps nothing.

### Where the runner lives

Workers cannot run Claude Code, so the runner lives on a Mac that is always on. It uses that Mac's own Claude Code login, and it costs nothing to run. The deployed app reaches it through a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/), which connects outward from the Mac, so no port is open to the internet.

The runner listens on this machine only, and refuses a run that does not show the secret it shares with the app. When the Mac is off or offline, the assistant says it cannot be reached, and the rest of the app works as usual.

To set it up on a Mac:

1. Put a secret of at least 32 characters in `apps/agent/.env` as `AGENT_SECRET`, as in `.env.example`. Give the Worker the same one with `wrangler secret put AGENT_SECRET`, and local development the same one in `apps/web/.dev.vars`.
2. Create the tunnel and point a hostname at it:

   ```sh
   cloudflared tunnel login
   cloudflared tunnel create ynabe-agent
   cloudflared tunnel route dns ynabe-agent ynabe-agent.marcoazzurrini.com
   ```

   Its config, `~/.cloudflared/ynabe-agent.yml`, sends that hostname to `http://localhost:8787`. `AGENT_URL` in `wrangler.jsonc` is the same hostname.

3. Start both at login with two launch agents in `~/Library/LaunchAgents`: `com.marcoazzurrini.ynabe.runner` runs `node --env-file=.env src/server.ts` in `apps/agent`, and `com.marcoazzurrini.ynabe.tunnel` runs `cloudflared tunnel --config ~/.cloudflared/ynabe-agent.yml run`. Their logs are `~/Library/Logs/ynabe-runner.log` and `ynabe-tunnel.log`.
4. Keep the Mac awake: `sudo pmset -c sleep 0`. The display can still turn off.

The runner runs the code in this checkout, so a change to `apps/agent` is live after `launchctl kickstart -k gui/$(id -u)/com.marcoazzurrini.ynabe.runner`. Local development uses the same runner, at `http://localhost:8787`. Set `AGENT_MODEL` in `apps/agent/.env` to change the model from `claude-opus-5-5`. It thinks at medium effort.

## Checks

`bun run check` runs formatting, lint (oxlint with Ultracite and anti-slop), types, tests, and builds. Lefthook formats and lints staged files before each commit and runs the full check on a clean copy before each push.

`main` is protected: changes land through pull requests once CI passes.

## Deploying

The app runs on Cloudflare Workers at <https://ynabe.marcoazzurrini.com>, with its data in the `ynabe` D1 database (Western Europe).

```sh
bun run --cwd apps/web db:migrate:remote   # apply new migrations first
bun run --cwd apps/web deploy              # build and deploy the Worker
```

Only `marco.azzurrini.art@gmail.com` can sign in, in two steps: Google, then a passkey. The first time, the app asks to create the passkey; after that, every new browser has to show it. Both steps last 30 days. Every server function answers 401 until both are passed, so the browser shell is all a stranger can load. Locally, copy `apps/web/.dev.vars.example` to `apps/web/.dev.vars` and fill in the values; the Google client lives in the `ynabe` Google Cloud project.

If the passkey is lost, remove it and create a new one at the next sign-in:

```sh
cd apps/web && bunx wrangler d1 execute ynabe --remote --command "DELETE FROM passkeys; DELETE FROM second_steps;"
```
