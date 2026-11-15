import { agentStep } from "@ynabe/db/thread";
import { z } from "zod";

/**
 * What travels while the assistant works: from the runner to the
 * server, and from the server to the app. This file needs nothing but
 * zod, so the browser can load it too.
 */

/** What the app hears while the assistant works. */
export const agentEvent = z.discriminatedUnion("type", [
  /** The assistant started a new piece of writing: drop the last one. */
  z.object({ type: z.literal("turn") }),
  z.object({ text: z.string(), type: z.literal("text") }),
  z.object({ step: agentStep, type: z.literal("step") }),
  /** The Claude subscription is close to, or past, its allowance. */
  z.object({ resetsAt: z.number().nullable(), type: z.literal("limit") }),
  z.object({ type: z.literal("done") }),
  z.object({ message: z.string(), type: z.literal("error") }),
]);

export type AgentEvent = z.infer<typeof agentEvent>;

/** The parts of a tool call the app words: the rest is not needed. */
export const toolInput = z
  .object({ month: z.string().optional(), search: z.string().optional() })
  .catch({});

export type ToolInput = z.infer<typeof toolInput>;

/** What the runner sends back. */
export const runnerEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("turn") }),
  z.object({ text: z.string(), type: z.literal("text") }),
  z.object({ input: toolInput, name: z.string(), type: z.literal("tool") }),
  z.object({
    resetsAt: z.number().nullable(),
    status: z.string(),
    type: z.literal("limit"),
  }),
  z.object({ error: z.boolean(), text: z.string(), type: z.literal("done") }),
]);

/**
 * Reads a response that carries one JSON event per line, as they
 * arrive. Lines that are not such an event are left out.
 *
 * @yields {Event} each event, once its line has arrived
 */
export const eventsFrom = async function* eventsFrom<Event>(
  response: Response,
  event: z.ZodType<Event>
): AsyncGenerator<Event> {
  if (!response.ok || !response.body) {
    throw new Error(`The answer was ${response.status}`);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let rest = "";

  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- each piece follows the one before
    const { done, value } = await reader.read();
    const lines = `${rest}${value ?? ""}`.split("\n");

    rest = lines.pop() ?? "";

    for (const line of lines.filter((text) => text !== "")) {
      const parsed = event.safeParse(JSON.parse(line));

      if (parsed.success) {
        yield parsed.data;
      }
    }

    if (done) {
      return;
    }
  }
};
