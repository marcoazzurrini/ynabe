import { z } from "zod";

/**
 * The parts of the assistant's conversation that are stored as JSON.
 * This file needs nothing but zod, so the browser can load it too.
 */

/** One thing the assistant looked at while answering. */
export const agentStep = z.object({
  kind: z.enum(["memory", "overview", "plan", "report", "search"]),
  label: z.string(),
});

export type AgentStep = z.infer<typeof agentStep>;

/** One line of a proposal, as the app shows it. */
export const proposalLine = z.object({
  /** A category icon name, or null. */
  icon: z.string().nullable(),
  label: z.string(),
  positive: z.boolean().optional(),
  value: z.string(),
});

export type ProposalLine = z.infer<typeof proposalLine>;
