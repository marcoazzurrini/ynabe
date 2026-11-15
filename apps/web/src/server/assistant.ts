import { readTicket, serveTools } from "@ynabe/agent";
import type { RunnerInput, Setup } from "@ynabe/agent";
import { createDb } from "@ynabe/db";

type Env = Cloudflare.Env;

const TOOLS = "/api/agent/mcp";

const init = (input: RunnerInput) => ({
  body: JSON.stringify(input),
  headers: { "Content-Type": "application/json" },
  method: "POST",
});

const runnerFor = (env: Env): Setup["runner"] | null => {
  // A runner started by hand, for local development.
  if (env.AGENT_URL) {
    const url = `${env.AGENT_URL}/run`;

    return (input) => fetch(url, init(input));
  }

  const runners = env.AGENT_RUNNER;

  return runners
    ? (input) =>
        runners.getByName("ledger").fetch("http://runner/run", init(input))
    : null;
};

/**
 * Starts the runner's container ahead of the first message. A stopped
 * container takes most of a minute to start, and it stops again when it
 * has been idle, so the app calls this as soon as it opens.
 */
export const wakeRunner = async (env: Env): Promise<void> => {
  // A runner started by hand is always up.
  if (env.AGENT_URL || !env.AGENT_RUNNER) {
    return;
  }

  try {
    const response = await env.AGENT_RUNNER.getByName("ledger").fetch(
      "http://runner/health"
    );

    await response.body?.cancel();
  } catch (error) {
    // The first message starts it instead.
    console.error("Could not wake the runner", error);
  }
};

/**
 * What the assistant runs with, or null when it is not set up. `origin`
 * is the address the app is being used on, which is where the runner
 * finds the tools. A timed run has none and uses the app's own address.
 */
export const setupFor = (env: Env, origin?: string): Setup | null => {
  const runner = runnerFor(env);
  const address = origin ?? env.BETTER_AUTH_URL;

  if (!runner || !env.BETTER_AUTH_SECRET || !address) {
    return null;
  }

  return {
    db: createDb(env.DB),
    model: env.AGENT_MODEL,
    runner,
    secret: env.BETTER_AUTH_SECRET,
    toolsUrl: new URL(TOOLS, address).href,
  };
};

/** Answers the runner when it calls a tool, if its pass is good. */
export const serveAgentTools = async (
  env: Env,
  request: Request
): Promise<Response> => {
  const ticket = request.headers.get("Authorization")?.replace(/^Bearer /u, "");

  const id =
    env.BETTER_AUTH_SECRET && ticket
      ? await readTicket(env.BETTER_AUTH_SECRET, ticket, Date.now())
      : null;

  if (!id) {
    return new Response("Unauthorized", { status: 401 });
  }

  return await serveTools(createDb(env.DB), { id, now: Date.now() }, request);
};
