# ynabe

A calm, AI-assisted envelope budgeting app, in the spirit of YNAB.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | TanStack Start app on Cloudflare Workers, with D1, TanStack DB and Charts |
| `apps/demo` | Storybook for the design system |
| `packages/budget` | The budget engine: one month of the budget from categories and money |
| `packages/reports` | Spending insights for Reflect: pace, day levels, usual ranges |
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

## Checks

`bun run check` runs formatting, lint (oxlint with Ultracite and anti-slop), types, tests, and builds. Lefthook formats and lints staged files before each commit and runs the full check on a clean copy before each push.

`main` is protected: changes land through pull requests once CI passes.

## Deploying

The app runs on Cloudflare Workers at <https://ynabe.marco-azzurrini-art.workers.dev>, with its data in the `ynabe` D1 database (Western Europe).

```sh
bun run --cwd apps/web db:migrate:remote   # apply new migrations first
bun run --cwd apps/web deploy              # build and deploy the Worker
```

The app has no sign-in yet, so anyone with the URL can see and change its data. Keep it to sample data until authentication lands.
