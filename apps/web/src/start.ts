import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

import { userFor } from "./server/auth";

/**
 * Server functions answer only to the signed-in, allowed account. The
 * check runs where the framework has already decided that a request is a
 * server function, so no spelling of the address can get around it.
 */
const signedIn = createMiddleware().server(
  async ({ handlerType, next, request }) => {
    if (handlerType !== "serverFn") {
      return next();
    }

    const { env } = await import("cloudflare:workers");

    if (await userFor(env, request)) {
      return next();
    }

    return Response.json(
      { error: "signed-out" },
      { headers: { "Cache-Control": "no-store" }, status: 401 }
    );
  }
);

// Another site must not be able to call a server function with the
// signed-in person's cookie.
const sameSite = createCsrfMiddleware({
  filter: ({ handlerType }) => handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [sameSite, signedIn],
}));
