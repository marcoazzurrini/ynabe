import { asc, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "./budget.ts";
import * as schema from "./schema.ts";
import { agentStep, proposalLine } from "./thread.ts";
import type { AgentStep, ProposalLine } from "./thread.ts";

const steps = z.array(agentStep);
const lines = z.array(proposalLine);

export interface AgentProposal {
  id: string;
  messageId: string;
  title: string;
  footnote: string;
  lines: ProposalLine[];
  /** The changes, as JSON: the assistant package knows their shape. */
  changes: string;
  status: "open" | "applied" | "dismissed";
}

export interface AgentMessage {
  id: string;
  at: number;
  role: "user" | "assistant";
  text: string;
  trigger: "chat" | "sync";
  steps: AgentStep[];
  proposals: AgentProposal[];
}

export interface AgentThread {
  /** The note the assistant keeps about its owner. */
  memory: string;
  /** The conversation before `messages`, folded down. */
  summary: string;
  /** The `at` of the last message the summary covers. */
  summarizedTo: number;
  messages: AgentMessage[];
}

type ProposalRow = typeof schema.agentProposals.$inferSelect;

const proposalOf = (row: ProposalRow): AgentProposal => ({
  changes: row.changes,
  footnote: row.footnote,
  id: row.id,
  lines: lines.parse(JSON.parse(row.lines)),
  messageId: row.messageId,
  status: row.status,
  title: row.title,
});

/**
 * Reads the conversation: all of it, or with `"open"` only the messages
 * the summary does not cover yet.
 */
export const loadThread = async (
  db: Database,
  part: "all" | "open" = "all"
): Promise<AgentThread> => {
  const notes = await db.select().from(schema.agentNotes);
  const summary = notes.find((note) => note.id === "summary");

  const rows = await db
    .select()
    .from(schema.agentMessages)
    .where(
      gt(schema.agentMessages.at, part === "open" ? (summary?.upTo ?? 0) : 0)
    )
    .orderBy(asc(schema.agentMessages.at));

  const proposals =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(schema.agentProposals)
          .where(
            inArray(
              schema.agentProposals.messageId,
              rows.map((row) => row.id)
            )
          )
          .orderBy(asc(schema.agentProposals.at));

  return {
    memory: notes.find((note) => note.id === "memory")?.content ?? "",
    messages: rows.map((row) => ({
      at: row.at,
      id: row.id,
      proposals: proposals
        .filter((proposal) => proposal.messageId === row.id)
        .map(proposalOf),
      role: row.role,
      steps: steps.parse(JSON.parse(row.steps)),
      text: row.text,
      trigger: row.trigger,
    })),
    summarizedTo: summary?.upTo ?? 0,
    summary: summary?.content ?? "",
  };
};

/** Adds a message to the end of the conversation. */
export const addMessage = async (
  db: Database,
  message: Omit<AgentMessage, "proposals">
): Promise<void> => {
  await db.insert(schema.agentMessages).values({
    at: message.at,
    id: message.id,
    role: message.role,
    steps: JSON.stringify(message.steps),
    text: message.text,
    trigger: message.trigger,
  });
};

/** Stores a proposal under the assistant message that made it. */
export const addProposal = async (
  db: Database,
  proposal: Omit<AgentProposal, "status">,
  at: number
): Promise<void> => {
  await db.insert(schema.agentProposals).values({
    at,
    changes: proposal.changes,
    footnote: proposal.footnote,
    id: proposal.id,
    lines: JSON.stringify(proposal.lines),
    messageId: proposal.messageId,
    title: proposal.title,
  });
};

export const findProposal = async (
  db: Database,
  id: string
): Promise<AgentProposal | null> => {
  const [row] = await db
    .select()
    .from(schema.agentProposals)
    .where(eq(schema.agentProposals.id, id));

  return row ? proposalOf(row) : null;
};

/** Drops the proposals of a run that never produced a message. */
export const dropProposals = async (
  db: Database,
  messageId: string
): Promise<void> => {
  await db
    .delete(schema.agentProposals)
    .where(eq(schema.agentProposals.messageId, messageId));
};

export const markProposal = async (
  db: Database,
  id: string,
  status: AgentProposal["status"]
): Promise<void> => {
  await db
    .update(schema.agentProposals)
    .set({ status })
    .where(eq(schema.agentProposals.id, id));
};

/** Replaces the note the assistant keeps about its owner. */
export const saveMemory = async (
  db: Database,
  content: string
): Promise<void> => {
  await db
    .insert(schema.agentNotes)
    .values({ content, id: "memory" })
    .onConflictDoUpdate({ set: { content }, target: schema.agentNotes.id });
};

/** Replaces the summary, which now covers messages up to `upTo`. */
export const saveSummary = async (
  db: Database,
  content: string,
  upTo: number
): Promise<void> => {
  await db
    .insert(schema.agentNotes)
    .values({ content, id: "summary", upTo })
    .onConflictDoUpdate({
      set: { content, upTo },
      target: schema.agentNotes.id,
    });
};
