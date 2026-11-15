export const BASE_PATH = "/api/auth";

/** Where the passkey step after Google sign-in is served. */
export const SECOND_STEP_PATH = "/api/passkey";

/**
 * Where a Google-signed-in browser stands on the passkey step: it has
 * shown the passkey, it still has to, or no passkey exists yet.
 */
export type SecondStepStatus = "passed" | "needed" | "setup";

/** The `error` query value after a rejected sign-in. */
export const ACCOUNT_NOT_ALLOWED = "account_not_allowed";

export interface User {
  readonly email: string;
  readonly name: string;
  /** Profile picture URL, if the account has one. */
  readonly image: string | null;
}
