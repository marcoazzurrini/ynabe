import { createServerFn } from "@tanstack/react-start";
import { applyChanges, change, runAssistant } from "@ynabe/agent";
import type { AgentEvent } from "@ynabe/agent";
import { createDb, findProposal, loadThread, markProposal } from "@ynabe/db";
import { z } from "zod";

import { setupFor, wakeRunner } from "./assistant";

/** The app shows this many messages; older ones stay in the database. */
const SHOWN = 100;

/** The conversation with the assistant, and whether it is set up. */
export const getThread = createServerFn({ method: "GET" }).handler(async () => {
  const { env, waitUntil } = await import("cloudflare:workers");

  // The app just opened: have the runner ready before the first message.
  waitUntil(wakeRunner(env));

  const thread = await loadThread(createDb(env.DB));

  return {
    connected: setupFor(env) !== null,
    messages: thread.messages.slice(-SHOWN).map((message) => ({
      ...message,
      proposals: message.proposals.map(
        ({ footnote, id, lines, status, title }) => ({
          footnote,
          id,
          lines,
          status,
          title,
        })
      ),
    })),
  };
});

const messageInput = z.object({
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u),
  screen: z.string().min(1).max(40),
  text: z.string().trim().min(1).max(4000),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
});

/**
 * Sends the assistant a message. The answer comes back as it is written,
 * one JSON event per line, and is kept even if the app stops listening.
 */
export const sendMessage = createServerFn({ method: "POST" })
  .validator(messageInput)
  .handler(async ({ data }) => {
    const { env, waitUntil } = await import("cloudflare:workers");
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    const send = async (event: AgentEvent) => {
      try {
        await writer.write(encoder.encode(`${JSON.stringify(event)}\n`));
      } catch {
        // The app stopped listening; the run goes on and is stored.
      }
    };

    const { getRequest } = await import("@tanstack/react-start/server");
    const setup = setupFor(env, new URL(getRequest().url).origin);
    // Events are written one after the other, in the order they came.
    let sent = Promise.resolve();

    const work = setup
      ? runAssistant(
          setup,
          {
            message: data.text,
            month: data.month,
            screen: data.screen,
            today: data.today,
            trigger: "chat",
          },
          (event) => {
            sent = sent.then(() => send(event));
          }
        )
      : send({ message: "The assistant is not set up yet.", type: "error" });

    waitUntil(
      work.finally(async () => {
        await sent;

        try {
          await writer.close();
        } catch {
          // Already closed from the other side.
        }
      })
    );

    return new Response(stream.readable, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/x-ndjson",
      },
    });
  });

const decisionInput = z.object({
  apply: z.boolean(),
  id: z.string().min(1),
});

/** Applies a proposal's changes to the budget, or sets it aside. */
export const decideProposal = createServerFn({ method: "POST" })
  .validator(decisionInput)
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const db = createDb(env.DB);
    const proposal = await findProposal(db, data.id);

    if (proposal?.status !== "open") {
      return;
    }

    if (data.apply) {
      await applyChanges(
        db,
        z.array(change).parse(JSON.parse(proposal.changes))
      );
    }

    await markProposal(db, data.id, data.apply ? "applied" : "dismissed");
  });
