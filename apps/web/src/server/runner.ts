import { DurableObject } from "cloudflare:workers";

const PORT = 8080;

/**
 * How long the container stays up after the last run. Starting it again
 * takes most of a minute, so it outlasts a pause in the conversation.
 */
const IDLE = 15 * 60 * 1000;

/**
 * Starts the runner's container when a run needs it and passes the run
 * on. The container holds nothing worth keeping: the conversation lives
 * in D1, so it can stop whenever it is idle.
 */
export class AgentRunner extends DurableObject<Cloudflare.Env> {
  private starting: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);

    const { container } = ctx;

    if (container?.running) {
      // A restart of this object forgets the timeout, so set it again.
      void ctx.blockConcurrencyWhile(() =>
        container.setInactivityTimeout(IDLE)
      );
    }
  }

  override async fetch(request: Request): Promise<Response> {
    this.starting ??= this.start().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const { container } = this.ctx;

    if (!container) {
      return new Response("The runner has no container", { status: 503 });
    }

    return container.getTcpPort(PORT).fetch(request);
  }

  private async start(): Promise<void> {
    const { container } = this.ctx;

    if (!container) {
      throw new Error("The runner has no container");
    }

    if (!container.running) {
      const token = {
        CLAUDE_CODE_OAUTH_TOKEN: this.env.CLAUDE_CODE_OAUTH_TOKEN ?? "",
      };

      // The model is left out when unset, so the runner keeps its default.
      const env = this.env.AGENT_MODEL
        ? { ...token, AGENT_MODEL: this.env.AGENT_MODEL }
        : token;

      container.start({
        // It reaches Anthropic, and the tools on this Worker's address.
        enableInternet: true,
        env,
        image: container.images.runner,
        // Claude Code needs more memory than the smallest size has.
        instance: "standard-1",
      });
    }

    await container.setInactivityTimeout(IDLE);

    await this.listening(container.getTcpPort(PORT), 150);
  }

  /** Waits for the server: `running` only means it was asked to start. */
  private async listening(port: Fetcher, tries: number): Promise<void> {
    try {
      const response = await port.fetch("http://runner/health", {
        signal: AbortSignal.timeout(1000),
      });

      await response.body?.cancel();

      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }

    if (tries === 0) {
      throw new Error("The runner did not start in time");
    }

    await scheduler.wait(200);
    await this.listening(port, tries - 1);
  }
}
