import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema.ts";

export {
  addMessage,
  addProposal,
  dropProposals,
  findProposal,
  loadThread,
  markProposal,
  saveMemory,
  saveSummary,
} from "./agent.ts";

export type { AgentMessage, AgentProposal, AgentThread } from "./agent.ts";

export { assign, categorize, loadBudget, setTarget } from "./budget.ts";

export type { Account, Budget, Database, LedgerTransaction } from "./budget.ts";

export { passkeyStore } from "./passkeys.ts";

export { synciFeed, syncBanks } from "./sync.ts";

export type { AgentStep, ProposalLine } from "./thread.ts";

export type { BankFeed, BankLink, Fetcher, SyncReport } from "./sync.ts";

/** Opens the app's D1 database with the schema attached. */
export const createDb = (d1: D1Database) => drizzle(d1, { schema });
