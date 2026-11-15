import { Database as Sqlite } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { addMessage, findProposal, loadBudget, loadThread } from "@ynabe/db";
import * as schema from "@ynabe/db/schema";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { z } from "zod";

import {
  applyChanges,
  briefing,
  change,
  afterSync,
  foldThread,
  readTicket,
  runAssistant,
  serveTools,
  stepFor,
  writeTicket,
} from "../src/index.ts";
import type { AgentEvent, Change, RunnerInput } from "../src/index.ts";

const open = async () => {
  const db = drizzle(new Sqlite(":memory:"), { schema });

  migrate(db, {
    migrationsFolder: `${import.meta.dir}/../../db/migrations`,
  });

  await db.insert(schema.accounts).values({ id: "revolut", name: "Revolut" });
  await db.insert(schema.categoryGroups).values({ id: "food", name: "Food" });
  await db.insert(schema.categories).values([
    { groupId: "food", icon: "cart", id: "groceries", name: "Groceries" },
    { groupId: "food", id: "eating-out", name: "Eating Out" },
  ]);
  await db.insert(schema.transactions).values([
    {
      accountId: "revolut",
      amount: 200_000,
      categoryId: "ready-to-assign",
      date: "2026-11-01",
      id: "pay",
      payee: "Employer",
    },
    {
      accountId: "revolut",
      amount: -4250,
      categoryId: "groceries",
      date: "2026-11-03",
      id: "shop-1",
      payee: "Esselunga",
    },
    {
      accountId: "revolut",
      amount: -1890,
      categoryId: null,
      date: "2026-11-05",
      id: "shop-2",
      memo: "CARD PAYMENT ESSELUNGA MILANO",
      payee: "Esselunga",
    },
  ]);

  return db;
};

type TestDb = Awaited<ReturnType<typeof open>>;

const answerOf = z.object({
  result: z.object({ content: z.array(z.object({ text: z.string() })) }),
});

/** The parts of a tool's answer these tests look at. */
const toolAnswer = z.object({
  count: z.number().optional(),
  problems: z.array(z.string()).optional(),
  readyToAssign: z.number().optional(),
  rows: z.array(z.object({ id: z.string(), payee: z.string() })).optional(),
  shown: z.boolean().optional(),
  total: z.number().optional(),
});

type ToolCall =
  | { name: "find_transactions"; input: { category?: string; search?: string } }
  | { name: "month_plan"; input: { month: string } }
  | {
      name: "propose_changes";
      input: { changes: Change[]; footnote: string; title: string };
    };

/** Calls a tool the way the runner does, and reads what it found. */
const call = async (
  db: TestDb,
  { name, input }: ToolCall,
  id = "run-1"
): Promise<z.infer<typeof toolAnswer>> => {
  const response = await serveTools(
    db,
    { id, now: 1000 },
    new Request("https://ynabe.test/api/agent/mcp", {
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: { arguments: input, name },
      }),
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      method: "POST",
    })
  );

  const { result } = answerOf.parse(await response.json());

  return toolAnswer.parse(JSON.parse(result.content[0]?.text ?? "null"));
};

const messagesOf = async (db: TestDb) => {
  const thread = await loadThread(db);

  return thread.messages;
};

describe("the assistant's tools", () => {
  test("finds transactions that still need a category", async () => {
    const db = await open();

    const found = await call(db, {
      name: "find_transactions",
      input: { category: "none" },
    });

    expect(found).toMatchObject({
      count: 1,
      rows: [{ id: "shop-2", payee: "Esselunga" }],
      total: -1890,
    });
  });

  test("searches the memo in any letter case", async () => {
    const db = await open();

    const found = await call(db, {
      name: "find_transactions",
      input: { search: "milano" },
    });

    expect(found).toMatchObject({ count: 1 });
  });

  test("reads the plan for a month", async () => {
    const db = await open();

    const plan = await call(db, {
      name: "month_plan",
      input: { month: "2026-11" },
    });

    expect(plan).toMatchObject({ readyToAssign: 198_110 });
  });

  test("a proposal changes nothing until it is applied", async () => {
    const db = await open();

    const changes: Change[] = [
      { categoryId: "groceries", kind: "categorize", transactionId: "shop-2" },
      {
        amount: 30_000,
        categoryId: "groceries",
        kind: "assign",
        month: "2026-11",
      },
    ];

    const answer = await call(db, {
      name: "propose_changes",
      input: {
        changes,
        footnote: "From how you filed Esselunga before",
        title: "Categorize 1 transaction",
      },
    });

    expect(answer).toMatchObject({ shown: true });

    const before = await loadBudget(db);

    expect(
      before.transactions.find((row) => row.id === "shop-2")?.categoryId
    ).toBeNull();

    await addMessage(db, {
      at: 1000,
      id: "run-1",
      role: "assistant",
      steps: [],
      text: "Here is a proposal.",
      trigger: "chat",
    });

    const messages = await messagesOf(db);
    const [proposal] = messages[0]?.proposals ?? [];

    expect(proposal?.lines).toEqual([
      { icon: "cart", label: "Esselunga · -18.90€", value: "Groceries" },
      {
        icon: "cart",
        label: "Groceries · 2026-11",
        positive: true,
        value: "+300.00€",
      },
    ]);

    const stored = await findProposal(db, proposal?.id ?? "");

    await applyChanges(
      db,
      z.array(change).parse(JSON.parse(stored?.changes ?? "[]"))
    );

    const after = await loadBudget(db);

    expect(
      after.transactions.find((row) => row.id === "shop-2")?.categoryId
    ).toBe("groceries");
    expect(after.assignments).toEqual([
      { amount: 30_000, categoryId: "groceries", month: "2026-11" },
    ]);
  });

  test("refuses a proposal that names something that is not there", async () => {
    const db = await open();

    const answer = await call(db, {
      name: "propose_changes",
      input: {
        changes: [
          {
            categoryId: "holidays",
            kind: "categorize",
            transactionId: "shop-2",
          },
        ],
        footnote: "A guess",
        title: "Categorize 1 transaction",
      },
    });

    expect(answer).toEqual({
      problems: ["No category has the id holidays"],
      shown: false,
    });
    expect(await messagesOf(db)).toEqual([]);
  });

  test("answers the runner over MCP", async () => {
    const db = await open();

    const response = await serveTools(
      db,
      { id: "run-1", now: 1000 },
      new Request("https://ynabe.test/api/agent/mcp", {
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    const body = z
      .object({
        result: z.object({ tools: z.array(z.object({ name: z.string() })) }),
      })
      .parse(await response.json());

    expect(body.result.tools.map((tool) => tool.name).toSorted()).toEqual([
      "budget_overview",
      "find_transactions",
      "month_plan",
      "propose_changes",
      "save_memory",
      "spending_report",
    ]);
  });

  test("words a tool call for the app", () => {
    expect(stepFor("mcp__ynabe__month_plan", { month: "2026-11" })).toEqual({
      kind: "plan",
      label: "Read the plan for November",
    });
    expect(stepFor("mcp__ynabe__propose_changes", {})).toBeNull();
  });
});

describe("the run ticket", () => {
  test("names its run until it expires", async () => {
    const ticket = await writeTicket("secret", "run-1", 2000);

    expect(await readTicket("secret", ticket, 1000)).toBe("run-1");
    expect(await readTicket("secret", ticket, 3000)).toBeNull();
    expect(await readTicket("other", ticket, 1000)).toBeNull();
    expect(
      await readTicket("secret", `run-2${ticket.slice(5)}`, 1000)
    ).toBeNull();
  });
});

describe("the briefing", () => {
  test("carries the notes, the conversation, and the new message", async () => {
    const db = await open();

    await addMessage(db, {
      at: 1,
      id: "m1",
      role: "user",
      steps: [],
      text: "File Esselunga under Groceries.",
      trigger: "chat",
    });

    const prompt = briefing(
      { ...(await loadThread(db)), memory: "Esselunga is Groceries." },
      {
        message: "What did I spend on food?",
        month: "2026-11",
        screen: "Plan",
        today: "2026-11-15",
        trigger: "chat",
      }
    );

    expect(prompt).toContain("<your_notes>\nEsselunga is Groceries.");
    expect(prompt).toContain("Owner: File Esselunga under Groceries.");
    expect(prompt).toContain("Plan screen open on 2026-11");
    expect(prompt).toEndWith(
      "<owner_message>\nWhat did I spend on food?\n</owner_message>"
    );
  });
});

/** A runner that answers with the given events instead of asking Claude. */
const runnerOf =
  (lines: object[], seen: RunnerInput[] = []) =>
  (input: RunnerInput) => {
    seen.push(input);

    return Promise.resolve(
      new Response(lines.map((line) => `${JSON.stringify(line)}\n`).join(""))
    );
  };

describe("a run", () => {
  test("stores the question and the answer, and reports as it goes", async () => {
    const db = await open();
    const seen: RunnerInput[] = [];
    const heard: AgentEvent[] = [];

    await runAssistant(
      {
        db,
        runner: runnerOf(
          [
            { type: "turn" },
            {
              input: { month: "2026-11" },
              name: "mcp__ynabe__month_plan",
              type: "tool",
            },
            { text: "You have 1,981.10€.", type: "text" },
            { error: false, text: " You have 1,981.10€. ", type: "done" },
          ],
          seen
        ),
        secret: "secret",
        toolsUrl: "https://ynabe.test/api/agent/mcp",
      },
      {
        message: "How much is ready to assign?",
        today: "2026-11-15",
        trigger: "chat",
      },
      (event) => heard.push(event)
    );

    const { messages } = await loadThread(db);

    expect(messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "How much is ready to assign?" },
      { role: "assistant", text: "You have 1,981.10€." },
    ]);
    expect(messages[1]?.steps).toEqual([
      { kind: "plan", label: "Read the plan for November" },
    ]);
    expect(heard.map((event) => event.type)).toEqual([
      "turn",
      "step",
      "text",
      "done",
    ]);

    const ticket = seen[0]?.tools?.ticket ?? "";

    expect(await readTicket("secret", ticket, Date.now())).toBe(
      messages[1]?.id ?? ""
    );
  });

  test("a failed run keeps the question and drops its proposals", async () => {
    const db = await open();
    const heard: AgentEvent[] = [];

    await runAssistant(
      {
        db,
        runner: async (input) => {
          const id = await readTicket(
            "secret",
            input.tools?.ticket ?? "",
            Date.now()
          );

          await call(
            db,
            {
              input: {
                changes: [
                  {
                    categoryId: "groceries",
                    kind: "categorize",
                    transactionId: "shop-2",
                  },
                ],
                footnote: "A guess",
                title: "Categorize 1 transaction",
              },
              name: "propose_changes",
            },
            id ?? ""
          );

          return new Response(
            `${JSON.stringify({ error: true, text: "Not signed in", type: "done" })}\n`
          );
        },
        secret: "secret",
        toolsUrl: "https://ynabe.test/api/agent/mcp",
      },
      { message: "File it.", today: "2026-11-15", trigger: "chat" },
      (event) => heard.push(event)
    );

    expect(heard).toEqual([
      {
        message: "The assistant could not answer: Not signed in",
        type: "error",
      },
    ]);
    const messages = await messagesOf(db);

    expect(messages.map((message) => message.role)).toEqual(["user"]);
    expect(await db.select().from(schema.agentProposals)).toEqual([]);
  });

  test("an automatic run with nothing to say leaves no message", async () => {
    const db = await open();

    await runAssistant(
      {
        db,
        runner: runnerOf([{ error: false, text: "NOTHING", type: "done" }]),
        secret: "secret",
        toolsUrl: "https://ynabe.test/api/agent/mcp",
      },
      afterSync(2, "2026-11-15")
    );

    expect(await messagesOf(db)).toEqual([]);
  });

  test("folds the oldest messages into the summary", async () => {
    const db = await open();
    const seen: RunnerInput[] = [];

    await db.insert(schema.agentMessages).values(
      Array.from({ length: 61 }, (_, index) => ({
        at: index + 1,
        id: `m${index + 1}`,
        role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
        text: `Message ${index + 1}`,
      }))
    );

    await foldThread({
      db,
      runner: runnerOf(
        [{ error: false, text: "The owner said many things.", type: "done" }],
        seen
      ),
      secret: "secret",
      toolsUrl: "https://ynabe.test/api/agent/mcp",
    });

    const rest = await loadThread(db, "open");

    expect(rest.summary).toBe("The owner said many things.");
    expect(rest.messages.map((message) => message.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `m${index + 42}`)
    );
    expect(seen[0]?.prompt).toContain("Message 41");
    expect(seen[0]?.prompt).not.toContain("Message 42");
    expect(await messagesOf(db)).toHaveLength(61);
  });
});
