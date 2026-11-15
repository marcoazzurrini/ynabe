import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { z } from "zod";

import { SECOND_STEP_PATH } from "./shared.ts";
import type { SecondStepStatus } from "./shared.ts";

export type { SecondStepStatus } from "./shared.ts";

/** A passkey as the store keeps it. The key is base64url text. */
export interface StoredPasskey {
  readonly id: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly transports: readonly string[];
}

/** Where passkeys, open challenges, and passed second steps are kept. */
export interface PasskeyStore {
  passkeys: (email: string) => Promise<StoredPasskey[]>;
  addPasskey: (email: string, passkey: StoredPasskey) => Promise<void>;
  setCounter: (id: string, counter: number) => Promise<void>;
  /** Replaces any challenge the account already has open. */
  saveChallenge: (
    email: string,
    challenge: string,
    expiresAt: number
  ) => Promise<void>;
  /** Returns the open challenge once, then forgets it. */
  takeChallenge: (email: string, now: number) => Promise<string | null>;
  savePass: (hash: string, email: string, expiresAt: number) => Promise<void>;
  hasPass: (hash: string, email: string, now: number) => Promise<boolean>;
  dropPass: (hash: string) => Promise<void>;
}

export interface SecondStepOptions {
  /** Public origin of the app, such as `https://example.com`. */
  readonly baseUrl: string;
  readonly store: PasskeyStore;
  /** The clock, in milliseconds. Tests replace it. */
  readonly now?: () => number;
}

export interface SecondStep {
  /** Whether this browser has passed the passkey step for the account. */
  status: (request: Request, email: string) => Promise<SecondStepStatus>;
  /**
   * Serves the passkey requests from the client. `email` is the account
   * that passed Google sign-in, or `null` when nobody has. Returns
   * `undefined` for requests that are not for the passkey step.
   */
  handle: (
    request: Request,
    email: string | null
  ) => Promise<Response | undefined>;
}

// A passed step lasts as long as the Google session it sits on.
const PASS_SECONDS = 30 * 24 * 60 * 60;
const CHALLENGE_MS = 5 * 60 * 1000;

const transport = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

const shared = {
  authenticatorAttachment: z.enum(["cross-platform", "platform"]).optional(),
  clientExtensionResults: z.object({
    appid: z.boolean().optional(),
    credProps: z.object({ rk: z.boolean().optional() }).optional(),
    hmacCreateSecret: z.boolean().optional(),
  }),
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
};

const registration = z.object({
  ...shared,
  response: z.object({
    attestationObject: z.string(),
    authenticatorData: z.string().optional(),
    clientDataJSON: z.string(),
    publicKey: z.string().optional(),
    publicKeyAlgorithm: z.number().optional(),
    transports: z.array(transport).optional(),
  }),
});

const authentication = z.object({
  ...shared,
  response: z.object({
    authenticatorData: z.string(),
    clientDataJSON: z.string(),
    signature: z.string(),
    userHandle: z.string().optional(),
  }),
});

const noStore = { "Cache-Control": "no-store" };

const refuse = (status: number, error: string) =>
  Response.json({ error }, { headers: noStore, status });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return isoBase64URL.fromBuffer(new Uint8Array(digest));
};

const cookieValue = (request: Request, name: string) => {
  const cookies = request.headers.get("Cookie") ?? "";

  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");

    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
};

/**
 * A passkey as the second step after Google sign-in. The first passkey
 * can be created by whoever passed Google sign-in; from then on, the
 * budget opens only in a browser that has also shown that passkey.
 */
export const createSecondStep = (options: SecondStepOptions): SecondStep => {
  const { origin, hostname, protocol } = new URL(options.baseUrl);
  const secure = protocol === "https:";
  const cookie = secure ? "__Secure-ynabe.second-step" : "ynabe.second-step";
  const now = options.now ?? Date.now;
  const { store } = options;

  const setCookie = (value: string, maxAge: number) =>
    [
      `${cookie}=${value}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
      ...(secure ? ["Secure"] : []),
    ].join("; ");

  const passed = async (request: Request, email: string) => {
    const token = cookieValue(request, cookie);

    return token
      ? await store.hasPass(await sha256(token), email, now())
      : false;
  };

  const status = async (
    request: Request,
    email: string
  ): Promise<SecondStepStatus> => {
    if (await passed(request, email)) {
      return "passed";
    }

    const passkeys = await store.passkeys(email);

    return passkeys.length > 0 ? "needed" : "setup";
  };

  /** What the browser needs to create or show a passkey. */
  const challenge = async (email: string) => {
    const passkeys = await store.passkeys(email);

    const request =
      passkeys.length > 0
        ? {
            kind: "verify" as const,
            options: await generateAuthenticationOptions({
              allowCredentials: passkeys.map(({ id, transports }) => ({
                id,
                transports: [...transports],
              })),
              rpID: hostname,
              userVerification: "required",
            }),
          }
        : {
            kind: "create" as const,
            options: await generateRegistrationOptions({
              attestationType: "none",
              authenticatorSelection: {
                residentKey: "preferred",
                userVerification: "required",
              },
              rpID: hostname,
              rpName: "ynabe",
              userName: email,
            }),
          };

    await store.saveChallenge(
      email,
      request.options.challenge,
      now() + CHALLENGE_MS
    );

    return Response.json(request, { headers: noStore });
  };

  const create = async (
    email: string,
    expected: string,
    response: z.infer<typeof registration>
  ) => {
    const { registrationInfo } = await verifyRegistrationResponse({
      expectedChallenge: expected,
      expectedOrigin: origin,
      expectedRPID: hostname,
      requireUserVerification: true,
      response,
    });

    if (!registrationInfo) {
      return false;
    }

    const { credential } = registrationInfo;

    await store.addPasskey(email, {
      counter: credential.counter,
      id: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      transports: credential.transports ?? [],
    });

    return true;
  };

  const show = async (
    passkeys: StoredPasskey[],
    expected: string,
    response: z.infer<typeof authentication>
  ) => {
    const passkey = passkeys.find(({ id }) => id === response.id);

    if (!passkey) {
      return false;
    }

    const { verified, authenticationInfo } = await verifyAuthenticationResponse(
      {
        credential: {
          counter: passkey.counter,
          id: passkey.id,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          transports: [...passkey.transports],
        },
        expectedChallenge: expected,
        expectedOrigin: origin,
        expectedRPID: hostname,
        requireUserVerification: true,
        response,
      }
    );

    if (verified) {
      await store.setCounter(passkey.id, authenticationInfo.newCounter);
    }

    return verified;
  };

  /** Checks the browser's answer and, when it holds, lets this browser in. */
  const answer = async (request: Request, email: string) => {
    const expected = await store.takeChallenge(email, now());

    if (!expected) {
      return refuse(400, "The passkey request ran out. Try again.");
    }

    const passkeys = await store.passkeys(email);
    const body: unknown = await request.json();
    const shown = authentication.safeParse(body);
    const created = registration.safeParse(body);
    let attempt = Promise.resolve(false);

    if (passkeys.length > 0 && shown.success) {
      attempt = show(passkeys, expected, shown.data);
    } else if (passkeys.length === 0 && created.success) {
      attempt = create(email, expected, created.data);
    }

    const ok = await attempt.catch(() => false);

    if (!ok) {
      return refuse(400, "That passkey was not accepted.");
    }

    const token = isoBase64URL.fromBuffer(
      crypto.getRandomValues(new Uint8Array(32))
    );

    await store.savePass(
      await sha256(token),
      email,
      now() + PASS_SECONDS * 1000
    );

    return Response.json(
      { ok: true },
      { headers: { ...noStore, "Set-Cookie": setCookie(token, PASS_SECONDS) } }
    );
  };

  const leave = async (request: Request) => {
    const token = cookieValue(request, cookie);

    if (token) {
      await store.dropPass(await sha256(token));
    }

    return Response.json(
      { ok: true },
      { headers: { ...noStore, "Set-Cookie": setCookie("", 0) } }
    );
  };

  return {
    async handle(request, email) {
      const { pathname } = new URL(request.url);

      if (!pathname.startsWith(`${SECOND_STEP_PATH}/`)) {
        return;
      }

      // Only this app's own pages may ask: the cookies ride along.
      if (
        request.method !== "POST" ||
        request.headers.get("Origin") !== origin
      ) {
        return refuse(403, "Not allowed from here.");
      }

      const step = pathname.slice(SECOND_STEP_PATH.length + 1);

      if (step === "leave") {
        return await leave(request);
      }

      if (!email) {
        return refuse(401, "Sign in with Google first.");
      }

      if (step === "challenge") {
        return await challenge(email);
      }

      if (step === "answer") {
        return await answer(request, email);
      }

      return refuse(404, "Unknown passkey request.");
    },
    status,
  };
};
