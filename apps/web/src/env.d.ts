declare namespace Cloudflare {
  interface Env {
    /** The Claude model the assistant uses. The runner has a default. */
    AGENT_MODEL?: string;
    /** What the runner asks to see before it runs anything. */
    AGENT_SECRET?: string;
    /** Where the runner is: a tunnel to the Mac, or localhost in dev. */
    AGENT_URL?: string;
    /** The Google accounts allowed to sign in, separated by commas. */
    AUTH_ALLOWED_EMAILS?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    DB: D1Database;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    /** A read-only Synci token. Without it the bank sync is off. */
    SYNCI_API_TOKEN?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
