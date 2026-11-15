import serverEntry from "@tanstack/react-start/server-entry";
import { afterSync, foldThread, runAssistant } from "@ynabe/agent";
import { createDb, syncBanks, synciFeed } from "@ynabe/db";

import { serveAgentTools, setupFor, wakeRunner } from "./server/assistant";
import { authFor, passkeyFor, sessionFor, userFor } from "./server/auth";

export { AgentRunner } from "./server/runner";

const SERVER_FUNCTIONS = "/_serverFn/";

/**
 * The timed run that only keeps the assistant's runner awake. It has to
 * match the second entry of `triggers.crons` in wrangler.jsonc.
 */
const KEEP_AWAKE = "*/5 * * * *";

const noStore = { "Cache-Control": "no-store" };

/**
 * Every request that can read or change the budget goes through here.
 * Server functions answer 401 unless an allowed account has signed in
 * with Google and shown its passkey, so the browser shell is the only
 * thing a stranger can load.
 *
 * The check on the address below is only a first, cheap answer. The
 * framework also accepts encoded spellings of the address, such as
 * `/%5FserverFn/`, so the check that counts is the one in start.ts.
 */
export default {
  async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    const auth = authFor(env);

    if (pathname.startsWith("/api/auth/")) {
      return (
        (await auth?.handle(request)) ??
        new Response("Sign-in is not configured", { status: 503 })
      );
    }

    if (pathname.startsWith("/api/passkey/")) {
      return (
        (await passkeyFor(env, request)) ??
        new Response("Sign-in is not configured", { status: 503 })
      );
    }

    // The runner calls the assistant's tools here. Its pass, not a
    // sign-in, is what opens them.
    if (pathname === "/api/agent/mcp") {
      return await serveAgentTools(env, request);
    }

    if (pathname === "/api/session") {
      const session = await sessionFor(env, request);

      return Response.json(
        {
          configured: Boolean(auth),
          secondStep: session?.secondStep ?? null,
          user: session?.user ?? null,
        },
        { headers: noStore }
      );
    }

    if (
      pathname.startsWith(SERVER_FUNCTIONS) &&
      !(await userFor(env, request))
    ) {
      return Response.json(
        { error: "signed-out" },
        { headers: noStore, status: 401 }
      );
    }

    return serverEntry.fetch(request);
  },

  /**
   * The timed runs. Every five minutes: keep the runner awake. Every six
   * hours: bring every linked bank account up to date, let the assistant
   * look at what is new, and tidy its conversation.
   */
  async scheduled(
    controller: ScheduledController,
    env: Cloudflare.Env
  ): Promise<void> {
    if (controller.cron === KEEP_AWAKE) {
      await wakeRunner(env);

      return;
    }

    const assistant = setupFor(env);

    if (env.SYNCI_API_TOKEN) {
      const report = await syncBanks(
        createDb(env.DB),
        synciFeed(env.SYNCI_API_TOKEN)
      );

      // Counts only: bank rows are private.
      console.log("Bank sync", report);

      if (report.added > 0 && assistant) {
        await runAssistant(
          assistant,
          afterSync(report.added, new Date().toISOString().slice(0, 10))
        );
      }
    }

    if (assistant) {
      await foldThread(assistant);
    }
  },
};
