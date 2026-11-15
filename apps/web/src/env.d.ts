declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    /** A read-only Synci token. Without it the bank sync is off. */
    SYNCI_API_TOKEN?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}
