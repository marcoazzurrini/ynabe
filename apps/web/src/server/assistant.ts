import { readTicket, serveTools } from "@ynabe/agent";
import type { RunnerInput, Setup } from "@ynabe/agent";
import { createDb } from "@ynabe/db";

type Env = Cloudflare.Env;

const TOOLS = "/api/agent/mcp";

/** Sends a run to the runner, which lives on a Mac behind a tunnel. */
const sendRun = async (
  address: string,
  secret: string,
  input: RunnerInput
): Promise<Response> => {
  let response: Response | null = null;

  try {
    response = await fetch(new URL("/run", address), {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch {
    // Handled below, like an answer from the tunnel alone.
  }

  // The tunnel answers 5xx by itself when the Mac is off or asleep.
  if (!response || response.status >= 500) {
    throw new Error("the Mac that runs it cannot be reached");
  }

  return response;
};

const runnerFor = (env: Env): Setup["runner"] | null => {
  const { AGENT_SECRET: secret, AGENT_URL: address } = env;

  return address && secret ? (input) => sendRun(address, secret, input) : null;
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
