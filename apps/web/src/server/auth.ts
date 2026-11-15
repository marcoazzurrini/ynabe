import { createAuth, createSecondStep } from "@ynabe/auth";
import type { Auth, SecondStep, SecondStepStatus, User } from "@ynabe/auth";
import { createDb, passkeyStore } from "@ynabe/db";

/** The Worker variables and secrets Google sign-in needs. */
export interface AuthEnv {
  readonly AUTH_ALLOWED_EMAILS?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
  readonly DB: D1Database;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
}

// A Worker reuses one env object across requests, so build auth once per env.
const cache = new WeakMap<AuthEnv, Auth | undefined>();

/** Google sign-in for this app, or `undefined` until it is configured. */
export const authFor = (env: AuthEnv): Auth | undefined => {
  if (cache.has(env)) {
    return cache.get(env);
  }

  const {
    AUTH_ALLOWED_EMAILS,
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = env;

  const auth =
    AUTH_ALLOWED_EMAILS &&
    BETTER_AUTH_SECRET &&
    BETTER_AUTH_URL &&
    GOOGLE_CLIENT_ID &&
    GOOGLE_CLIENT_SECRET
      ? createAuth({
          allowedEmails: AUTH_ALLOWED_EMAILS.split(","),
          baseUrl: BETTER_AUTH_URL,
          google: {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
          },
          secret: BETTER_AUTH_SECRET,
        })
      : undefined;

  cache.set(env, auth);

  return auth;
};

const steps = new WeakMap<AuthEnv, SecondStep>();

/** The passkey step that follows Google sign-in. */
const secondStepFor = (env: AuthEnv, baseUrl: string): SecondStep => {
  const known = steps.get(env);

  if (known) {
    return known;
  }

  const step = createSecondStep({
    baseUrl,
    store: passkeyStore(createDb(env.DB)),
  });

  steps.set(env, step);

  return step;
};

/** Who passed Google sign-in, and where they stand on the passkey step. */
export interface Session {
  readonly secondStep: SecondStepStatus;
  readonly user: User;
}

// Passkeys belong to the account whatever the case of its address.
const keyOf = (user: User) => user.email.toLowerCase();

/** The allowed account that passed Google sign-in, or null. */
export const sessionFor = async (
  env: AuthEnv,
  request: Request
): Promise<Session | null> => {
  const user = (await authFor(env)?.user(request)) ?? null;

  if (!user || !env.BETTER_AUTH_URL) {
    return null;
  }

  const step = secondStepFor(env, env.BETTER_AUTH_URL);

  return { secondStep: await step.status(request, keyOf(user)), user };
};

/** The user who passed both Google sign-in and the passkey step, or null. */
export const userFor = async (
  env: AuthEnv,
  request: Request
): Promise<User | null> => {
  const session = await sessionFor(env, request);

  return session?.secondStep === "passed" ? session.user : null;
};

/**
 * Serves the passkey step. Returns `undefined` when sign-in is not set
 * up or the request is not for the passkey step.
 */
export const passkeyFor = async (
  env: AuthEnv,
  request: Request
): Promise<Response | undefined> => {
  const auth = authFor(env);

  if (!auth || !env.BETTER_AUTH_URL) {
    return;
  }

  const user = await auth.user(request);

  return await secondStepFor(env, env.BETTER_AUTH_URL).handle(
    request,
    user ? keyOf(user) : null
  );
};
