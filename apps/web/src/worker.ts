import serverEntry from "@tanstack/react-start/server-entry";
import { createDb, syncBanks, synciFeed } from "@ynabe/db";

import { authFor, userFor } from "./server/auth";
import type { AuthEnv } from "./server/auth";

const SERVER_FUNCTIONS = "/_serverFn/";

const noStore = { "Cache-Control": "no-store" };

/**
 * Every request that can read or change the budget goes through here.
 * Server functions answer 401 unless an allowed account is signed in, so
 * the browser shell is the only thing a stranger can load.
 *
 * The check on the address below is only a first, cheap answer. The
 * framework also accepts encoded spellings of the address, such as
 * `/%5FserverFn/`, so the check that counts is the one in start.ts.
 */
export default {
  async fetch(request: Request, env: AuthEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    const auth = authFor(env);

    if (pathname.startsWith("/api/auth/")) {
      return (
        (await auth?.handle(request)) ??
        new Response("Sign-in is not configured", { status: 503 })
      );
    }

    if (pathname === "/api/session") {
      const user = await userFor(env, request);

      return Response.json(
        { configured: Boolean(auth), user },
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

  /** The timed run: brings every linked bank account up to date. */
  async scheduled(
    _controller: ScheduledController,
    env: Cloudflare.Env
  ): Promise<void> {
    if (env.SYNCI_API_TOKEN) {
      const report = await syncBanks(
        createDb(env.DB),
        synciFeed(env.SYNCI_API_TOKEN)
      );

      // Counts only: bank rows are private.
      console.log("Bank sync", report);
    }
  },
};
