import { addMessage, dropProposals, loadThread, saveSummary } from "@ynabe/db";
import type { AgentStep, Database } from "@ynabe/db";

import {
  briefing,
  FOLD_AT,
  foldPrompt,
  KEEP,
  SUMMARY_SYSTEM,
  SYSTEM,
} from "./briefing.ts";
import type { Occasion } from "./briefing.ts";
import { eventsFrom, runnerEvent } from "./events.ts";
import type { AgentEvent } from "./events.ts";
import { writeTicket } from "./ticket.ts";
import { stepFor } from "./tools.ts";

/** What a run is sent to the runner with. */
export interface RunnerInput {
  model?: string;
  prompt: string;
  system: string;
  /** Where the tools are, and the pass that opens them for this run. */
  tools?: { ticket: string; url: string };
}

/** Where the assistant runs: the database, the runner, and the tools. */
export interface Setup {
  db: Database;
  /** Signs the pass that lets the runner call the tools. */
  secret: string;
  /** The address the runner reaches the tools on. */
  toolsUrl: string;
  /** Sends a run to Claude Code; the answer is one JSON event per line. */
  runner: (input: RunnerInput) => Promise<Response>;
  model?: string;
}

/** A run may take this long before its pass to the tools runs out. */
const TICKET_LIFE = 15 * 60 * 1000;

/** What an automatic run answers when it has nothing worth saying. */
const NOTHING = "NOTHING";

interface Outcome {
  error: boolean;
  text: string;
  steps: AgentStep[];
}

/** Asks the runner once and passes on what happens until it is done. */
const ask = async (
  setup: Setup,
  input: RunnerInput,
  report: (event: AgentEvent) => void
): Promise<Outcome> => {
  const steps: AgentStep[] = [];

  try {
    const response = await setup.runner(input);

    for await (const event of eventsFrom(response, runnerEvent)) {
      if (event.type === "done") {
        return { error: event.error, steps, text: event.text };
      }

      if (event.type === "tool") {
        const step = stepFor(event.name, event.input);

        if (step) {
          steps.push(step);
          report({ step, type: "step" });
        }
      } else if (event.type === "limit") {
        if (event.status !== "allowed") {
          report({ resetsAt: event.resetsAt, type: "limit" });
        }
      } else {
        report(event);
      }
    }

    return { error: true, steps, text: "The assistant stopped half way" };
  } catch (error) {
    console.error("Assistant run failed", error);

    return {
      error: true,
      steps,
      text: error instanceof Error ? error.message : "The run failed",
    };
  }
};

const nobody = () => {
  // An automatic run has nobody watching.
};

/**
 * Runs the assistant once: for a message the owner typed, or by itself
 * after a bank sync. The answer joins the one conversation in the
 * database, and `report` hears about it as it happens.
 */
export const runAssistant = async (
  setup: Setup,
  occasion: Occasion,
  report: (event: AgentEvent) => void = nobody
): Promise<void> => {
  const { db } = setup;
  const thread = await loadThread(db, "open");
  const id = crypto.randomUUID();

  if (occasion.trigger === "chat") {
    await addMessage(db, {
      at: Date.now(),
      id: crypto.randomUUID(),
      role: "user",
      steps: [],
      text: occasion.message,
      trigger: "chat",
    });
  }

  const outcome = await ask(
    setup,
    {
      model: setup.model,
      prompt: briefing(thread, occasion),
      system: SYSTEM,
      tools: {
        ticket: await writeTicket(setup.secret, id, Date.now() + TICKET_LIFE),
        url: setup.toolsUrl,
      },
    },
    report
  );

  const quiet = occasion.trigger === "sync" && outcome.text.trim() === NOTHING;

  if (outcome.error || quiet) {
    // Proposals belong under a message, and this run leaves none.
    await dropProposals(db, id);

    report(
      outcome.error
        ? {
            message: `The assistant could not answer: ${outcome.text}`,
            type: "error",
          }
        : { type: "done" }
    );

    return;
  }

  await addMessage(db, {
    at: Date.now(),
    id,
    role: "assistant",
    steps: outcome.steps,
    text: outcome.text.trim(),
    trigger: occasion.trigger,
  });

  report({ type: "done" });
};

/** What the assistant is told after a bank sync brought new rows. */
export const afterSync = (added: number, today: string): Occasion => ({
  message: `The bank sync just added ${added} new ${added === 1 ? "transaction" : "transactions"}. Look at the transactions that still need a category. Where the owner's history or your notes make the category clear, put them in one proposal. Mention anything that looks unusual, in a sentence or two. The owner reads this the next time they open the app. If there is nothing to propose and nothing worth saying, reply with exactly ${NOTHING}.`,
  today,
  trigger: "sync",
});

/**
 * Keeps the prompt short: once enough messages sit outside the summary,
 * the oldest are folded into it and the newest stay word for word.
 */
export const foldThread = async (setup: Setup): Promise<void> => {
  const { db } = setup;
  const thread = await loadThread(db, "open");

  if (thread.messages.length <= FOLD_AT) {
    return;
  }

  const old = thread.messages.slice(0, -KEEP);
  const last = old.at(-1);

  const outcome = await ask(
    setup,
    {
      model: setup.model,
      prompt: foldPrompt({ ...thread, messages: old }),
      system: SUMMARY_SYSTEM,
    },
    nobody
  );

  if (!outcome.error && last) {
    await saveSummary(db, outcome.text.trim(), last.at);
  }
};
