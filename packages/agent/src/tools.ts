import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { planMonth, READY_TO_ASSIGN } from "@ynabe/budget";
import { addProposal, loadBudget, saveMemory } from "@ynabe/db";
import type { AgentStep, Budget, Database } from "@ynabe/db";
import { spendingReport } from "@ynabe/reports";
import { z } from "zod";

import { change, describeChanges } from "./changes.ts";
import type { ToolInput } from "./events.ts";

/** The longest note the assistant may keep about its owner. */
export const MEMORY_LIMIT = 4000;

const month = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u)
  .describe("A month, written YYYY-MM");

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .describe("A day, written YYYY-MM-DD");

/** One run of the assistant: its proposals go under the message `id`. */
export interface Run {
  id: string;
  /** Milliseconds since 1970. */
  now: number;
}

/** Wraps what a tool found as the text MCP sends back. */
const answer = <Found extends object>(found: Found) => ({
  content: [{ text: JSON.stringify(found), type: "text" as const }],
});

const overview = (budget: Budget) => ({
  accounts: budget.accounts.map((account) => ({
    balance: budget.transactions
      .filter((row) => row.accountId === account.id)
      .reduce((total, row) => total + row.amount, 0),
    closed: account.closed,
    id: account.id,
    kind: account.kind,
    name: account.name,
  })),
  groups: budget.groups.map((group) => ({
    categories: budget.categories
      .filter((category) => category.groupId === group.id)
      .map(({ id, name, target }) => ({ id, name, target: target ?? null })),
    name: group.name,
  })),
  transactions: {
    count: budget.transactions.length,
    first: budget.transactions.map((row) => row.date).toSorted()[0] ?? null,
    last:
      budget.transactions
        .map((row) => row.date)
        .toSorted()
        .at(-1) ?? null,
    uncategorized: budget.transactions.filter(
      (row) => row.categoryId === null && !row.transfer
    ).length,
  },
});

const monthPlan = (budget: Budget, which: string) => {
  const plan = planMonth(budget, which);

  return {
    activity: plan.activity,
    assigned: plan.assigned,
    attention: plan.attention,
    available: plan.available,
    categories: plan.categories.map((category) => ({
      activity: category.activity,
      assigned: category.assigned,
      available: category.available,
      group: budget.groups.find((group) => group.id === category.groupId)?.name,
      id: category.id,
      name: category.name,
      needed: category.needed,
      status: category.status,
    })),
    month: plan.month,
    readyToAssign: plan.readyToAssign,
  };
};

const spending = (budget: Budget, which: string) => {
  const report = spendingReport({ ...budget, groups: budget.groups }, which);

  return {
    categories: report.categories
      .filter((category) => category.spent !== 0 || category.unusual)
      .map(({ id, name, spent, usual, unusual }) => ({
        id,
        name,
        spent,
        unusual,
        usual,
      })),
    change: report.change,
    dailyAverage: report.dailyAverage,
    groups: report.groups.map(({ name, spent, share, usual, unusual }) => ({
      name,
      share,
      spent,
      unusual,
      usual,
    })),
    income: report.income,
    month: report.month,
    months: report.months,
    previous: report.previous,
    spent: report.spent,
  };
};

const filters = {
  account: z.string().optional().describe("Only this account id"),
  category: z
    .string()
    .optional()
    .describe(
      `Only this category id, "${READY_TO_ASSIGN}" for income, or "none" for transactions that still need a category`
    ),
  from: day.optional(),
  limit: z.number().int().min(1).max(200).default(50),
  search: z
    .string()
    .optional()
    .describe("Words to find in the payee or the memo, in any letter case"),
  to: day.optional(),
};

const transactions = (
  budget: Budget,
  query: z.infer<z.ZodObject<typeof filters>>
) => {
  const words = query.search?.toLowerCase();

  const found = budget.transactions
    .filter(
      (row) =>
        (!query.account || row.accountId === query.account) &&
        (!query.from || row.date >= query.from) &&
        (!query.to || row.date <= query.to) &&
        (!words ||
          row.payee.toLowerCase().includes(words) ||
          (row.memo ?? "").toLowerCase().includes(words)) &&
        (!query.category ||
          (query.category === "none"
            ? row.categoryId === null && !row.transfer
            : row.categoryId === query.category))
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));

  return {
    count: found.length,
    rows: found.slice(0, query.limit).map((row) => ({
      account: row.accountId,
      amount: row.amount,
      category: row.categoryId,
      cleared: row.cleared,
      date: row.date,
      id: row.id,
      memo: row.memo,
      payee: row.payee,
      transferTo: row.transferAccountId,
    })),
    total: found.reduce((sum, row) => sum + row.amount, 0),
  };
};

/** Gives a server the assistant's tools, for one run. */
const addTools = (server: McpServer, db: Database, run: Run): void => {
  server.registerTool(
    "budget_overview",
    {
      description:
        "The accounts with their balances, the category groups with every category id and target, and how many transactions there are. Start here to learn the ids.",
    },
    async () => answer(overview(await loadBudget(db)))
  );

  server.registerTool(
    "find_transactions",
    {
      description:
        "Transactions that match the filters, newest first, with how many matched and what they add up to. Use it to answer questions about payees, dates and amounts.",
      inputSchema: filters,
    },
    async (query) => answer(transactions(await loadBudget(db), query))
  );

  server.registerTool(
    "month_plan",
    {
      description:
        "The plan for one month: Ready to Assign, and for every category what is assigned, spent (activity), available, and still needed for its target.",
      inputSchema: { month },
    },
    async (input) => answer(monthPlan(await loadBudget(db), input.month))
  );

  server.registerTool(
    "spending_report",
    {
      description:
        "How one month of spending compares with the month before and with the usual range of the last six months, by group and by category, plus income and the last 12 months of totals.",
      inputSchema: { month },
    },
    async (input) => answer(spending(await loadBudget(db), input.month))
  );

  server.registerTool(
    "propose_changes",
    {
      description:
        "Shows the owner a proposal with changes to the budget: file transactions under categories, set what a category has assigned in a month, or set a target. Nothing changes until the owner applies it in the app. Put related changes in one proposal.",
      inputSchema: {
        changes: z.array(change).min(1).max(200),
        footnote: z
          .string()
          .min(1)
          .max(120)
          .describe(
            "One short line on where this comes from or what it leaves"
          ),
        title: z
          .string()
          .min(1)
          .max(80)
          .describe('What the proposal does, like "Categorize 4 transactions"'),
      },
    },
    async (input) => {
      const { lines, problems } = describeChanges(
        await loadBudget(db),
        input.changes
      );

      if (problems.length > 0) {
        return answer({ problems, shown: false });
      }

      await addProposal(
        db,
        {
          changes: JSON.stringify(input.changes),
          footnote: input.footnote,
          id: crypto.randomUUID(),
          lines,
          messageId: run.id,
          title: input.title,
        },
        run.now
      );

      return answer({
        note: "The owner now sees the proposal. Nothing has changed yet: they apply or dismiss it in the app.",
        shown: true,
      });
    }
  );

  server.registerTool(
    "save_memory",
    {
      description: `Replaces the note you keep about the owner between conversations: lasting preferences and facts, never transactions. Send the whole note each time, at most ${MEMORY_LIMIT} characters.`,
      inputSchema: { note: z.string().max(MEMORY_LIMIT) },
    },
    async (input) => {
      await saveMemory(db, input.note);

      return answer({ saved: true });
    }
  );
};

/** Answers one request from the runner, which speaks MCP over HTTP. */
export const serveTools = async (
  db: Database,
  run: Run,
  request: Request
): Promise<Response> => {
  const server = new McpServer({ name: "ynabe", version: "1.0.0" });

  addTools(server, db, run);

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });

  await server.connect(transport);

  return await transport.handleRequest(request);
};

const monthLabel = (value?: string): string =>
  value && /^\d{4}-\d{2}$/u.test(value)
    ? new Date(`${value}-01T00:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        timeZone: "UTC",
      })
    : "the month";

/** How the app words a tool call, or null for one it does not show. */
export const stepFor = (name: string, input: ToolInput): AgentStep | null => {
  switch (name.replace(/^mcp__ynabe__/u, "")) {
    case "budget_overview": {
      return { kind: "overview", label: "Looked over accounts and categories" };
    }

    case "find_transactions": {
      return {
        kind: "search",
        label: input.search
          ? `Searched transactions for “${input.search}”`
          : "Looked through transactions",
      };
    }

    case "month_plan": {
      return {
        kind: "plan",
        label: `Read the plan for ${monthLabel(input.month)}`,
      };
    }

    case "spending_report": {
      return {
        kind: "report",
        label: `Compared spending in ${monthLabel(input.month)}`,
      };
    }

    case "save_memory": {
      return { kind: "memory", label: "Updated its notes about you" };
    }

    default: {
      return null;
    }
  }
};
