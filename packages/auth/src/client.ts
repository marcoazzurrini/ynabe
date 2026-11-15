import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { createAuthClient } from "better-auth/client";
import { z } from "zod";

import { BASE_PATH, SECOND_STEP_PATH } from "./shared.ts";

export { ACCOUNT_NOT_ALLOWED } from "./shared.ts";

export type { SecondStepStatus } from "./shared.ts";

const client = createAuthClient({ basePath: BASE_PATH });

/**
 * Leaves for Google sign-in, then returns to the current page. A rejected
 * account returns with `?error=` set to `ACCOUNT_NOT_ALLOWED`.
 */
export const signIn = async () => {
  // Drop an earlier sign-in error so it does not survive a later success.
  const url = new URL(location.href);
  url.searchParams.delete("error");
  const here = `${url.pathname}${url.search}`;

  const { error } = await client.signIn.social({
    callbackURL: here,
    errorCallbackURL: here,
    provider: "google",
  });

  if (error) {
    throw new Error(error.message ?? "Sign-in could not start");
  }
};

const transport = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const credential = z.object({
  id: z.string(),
  transports: z.array(transport).optional(),
  type: z.literal("public-key"),
});

const userVerification = z.enum(["discouraged", "preferred", "required"]);

// What the server sends for the browser to create or show a passkey.
const challenge = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("create"),
    options: z.object({
      attestation: z.enum(["direct", "enterprise", "indirect", "none"]),
      authenticatorSelection: z.object({
        requireResidentKey: z.boolean().optional(),
        residentKey: z.enum(["discouraged", "preferred", "required"]),
        userVerification,
      }),
      challenge: z.string(),
      excludeCredentials: z.array(credential).optional(),
      extensions: z.object({ credProps: z.boolean().optional() }).optional(),
      pubKeyCredParams: z.array(
        z.object({ alg: z.number(), type: z.literal("public-key") })
      ),
      rp: z.object({ id: z.string(), name: z.string() }),
      timeout: z.number().optional(),
      user: z.object({
        displayName: z.string(),
        id: z.string(),
        name: z.string(),
      }),
    }),
  }),
  z.object({
    kind: z.literal("verify"),
    options: z.object({
      allowCredentials: z.array(credential).optional(),
      challenge: z.string(),
      rpId: z.string(),
      timeout: z.number().optional(),
      userVerification,
    }),
  }),
]);

const failure = z.object({ error: z.string() });

// `body` is JSON text.
const ask = async (step: string, body = "{}") => {
  const response = await fetch(`${SECOND_STEP_PATH}/${step}`, {
    body,
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  const answer: unknown = await response.json();

  if (!response.ok) {
    const parsed = failure.safeParse(answer);

    throw new Error(
      parsed.success ? parsed.data.error : "The passkey step failed."
    );
  }

  return answer;
};

/**
 * The step after Google sign-in: asks the browser for the account's
 * passkey, or creates the first one. Resolves once this browser is let in.
 */
export const passSecondStep = async () => {
  const request = challenge.parse(await ask("challenge"));

  const response =
    request.kind === "create"
      ? await startRegistration({ optionsJSON: request.options })
      : await startAuthentication({ optionsJSON: request.options });

  await ask("answer", JSON.stringify(response));
};

export const signOut = async () => {
  // The passkey step is forgotten first, while the cookies still say who asks.
  await ask("leave").catch(() => null);

  const { error } = await client.signOut();

  if (error) {
    throw new Error(error.message ?? "Sign-out failed");
  }
};

/** The signed-in Google account, or `null` when nobody is signed in. */
export const getAccount = async () => {
  const { data, error } = await client.getSession();

  if (error) {
    throw new Error(error.message ?? "Could not load the account");
  }

  return data ? { email: data.user.email, name: data.user.name } : null;
};
