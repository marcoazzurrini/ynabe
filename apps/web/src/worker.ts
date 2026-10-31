import serverEntry from "@tanstack/react-start/server-entry";

import { authFor, userFor } from "./server/auth";
import type { AuthEnv } from "./server/auth";

const SERVER_FUNCTIONS = "/_serverFn/";

const noStore = { "Cache-Control": "no-store" };

/**
 * Every request that can read or change the budget goes through here.
 * Server functions answer 401 unless an allowed account is signed in, so
 * the browser shell is the only thing a stranger can load.
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
};
