import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { text } from "node:stream/consumers";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

/**
 * The runner: one small server that runs the assistant with Claude Code.
 *
 * It knows nothing about the budget. Each request brings the prompt and
 * the address of the tools, and gets back what happens, one JSON object
 * per line. It signs in with the Claude subscription in
 * CLAUDE_CODE_OAUTH_TOKEN, or with the login of whoever starts it.
 */

const PORT = Number(process.env.PORT ?? 8080);
const MODEL = process.env.AGENT_MODEL ?? "claude-opus-5-5";

/** How hard the model thinks before it answers. */
const EFFORT = "medium";

const runInput = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  system: z.string().min(1),
  /** Where the tools are, and the pass that opens them for this run. */
  tools: z.object({ ticket: z.string(), url: z.url() }).optional(),
});

type RunInput = z.infer<typeof runInput>;

/** What the runner reports while it works, one per line. */
type RunEvent =
  /** The assistant started a new piece of writing. */
  | { type: "turn" }
  | { type: "text"; text: string }
  | { type: "tool"; name: string; input: unknown }
  /** How much of the subscription's allowance is used. */
  | {
      type: "limit";
      status: string;
      window: string | null;
      resetsAt: number | null;
    }
  | { type: "done"; text: string; error: boolean };

// An empty folder, so Claude Code finds no project files to read.
const emptyFolder = mkdtempSync(path.join(tmpdir(), "ynabe-agent-"));

// Started from inside a Claude Code session, these would make the child
// think it is part of that session.
const {
  CLAUDECODE: _,
  CLAUDE_CODE_ENTRYPOINT: __,
  ...environment
} = process.env;

const run = async function* run(
  input: RunInput,
  abortController: AbortController
): AsyncGenerator<RunEvent> {
  const messages = query({
    options: {
      abortController,
      allowedTools: input.tools ? ["mcp__ynabe"] : [],
      cwd: emptyFolder,
      effort: EFFORT,
      env: environment,
      includePartialMessages: true,
      maxTurns: 40,
      mcpServers: input.tools
        ? {
            ynabe: {
              headers: { Authorization: `Bearer ${input.tools.ticket}` },
              type: "http",
              url: input.tools.url,
            },
          }
        : {},
      model: input.model ?? MODEL,
      // Anything that is not one of the budget tools is refused.
      permissionMode: "dontAsk",
      persistSession: false,
      settingSources: [],
      stderr: (line) => console.error(line.trimEnd()),
      strictMcpConfig: true,
      systemPrompt: input.system,
      // No files, no shell, no web: only the budget tools.
      tools: [],
    },
    prompt: input.prompt,
  });

  for await (const message of messages) {
    if (message.type === "stream_event" && !message.parent_tool_use_id) {
      const { event } = message;

      if (event.type === "message_start") {
        yield { type: "turn" };
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { text: event.delta.text, type: "text" };
      }
    } else if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          yield { input: block.input, name: block.name, type: "tool" };
        }
      }
    } else if (message.type === "rate_limit_event") {
      const info = message.rate_limit_info;

      yield {
        resetsAt: info.resetsAt ?? null,
        status: info.status,
        type: "limit",
        window: info.rateLimitType ?? null,
      };
    } else if (message.type === "result") {
      yield message.subtype === "success"
        ? { error: message.is_error, text: message.result, type: "done" }
        : { error: true, text: message.subtype, type: "done" };
    }
  }
};

/** The run a request asks for, or null when it does not make sense. */
const runFrom = async (request: IncomingMessage): Promise<RunInput | null> => {
  try {
    return runInput.parse(JSON.parse(await text(request)));
  } catch {
    return null;
  }
};

const answer = async (
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200).end("ok");

    return;
  }

  if (request.method !== "POST" || request.url !== "/run") {
    response.writeHead(404).end();

    return;
  }

  const input = await runFrom(request);

  if (!input) {
    response.writeHead(400).end("That is not a run");

    return;
  }

  const abortController = new AbortController();

  // Nobody is listening any more, so stop spending the allowance.
  response.on("close", () => {
    if (!response.writableEnded) {
      abortController.abort();
    }
  });

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": "application/x-ndjson",
  });

  const send = (event: RunEvent) =>
    response.write(`${JSON.stringify(event)}\n`);

  // Claude Code reports a failed run and then throws: say it once.
  let done = false;

  try {
    for await (const event of run(input, abortController)) {
      done ||= event.type === "done";
      send(event);
    }
  } catch (error) {
    console.error(error);

    if (!done) {
      send({
        error: true,
        text: error instanceof Error ? error.message : "The run failed",
        type: "done",
      });
    }
  }

  response.end();
};

createServer((request, response) => {
  void answer(request, response);
}).listen(PORT, () => {
  console.log(`The runner listens on port ${PORT}`);
});
