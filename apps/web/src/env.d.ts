declare namespace Cloudflare {
  interface Env {
    /** The Claude model the assistant uses. The runner has a default. */
    AGENT_MODEL?: string;
    /** The runner's container. Absent when containers are off, as in dev. */
    AGENT_RUNNER?: DurableObjectNamespace;
    /** A runner started by hand, for local development. */
    AGENT_URL?: string;
    /** The Google accounts allowed to sign in, separated by commas. */
    AUTH_ALLOWED_EMAILS?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    /** From `claude setup-token`: the assistant runs on this subscription. */
    CLAUDE_CODE_OAUTH_TOKEN?: string;
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
