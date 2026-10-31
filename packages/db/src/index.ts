import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema.ts";

export { assign, loadBudget } from "./budget.ts";

export type { Account, Budget, Database, LedgerTransaction } from "./budget.ts";

/** Opens the app's D1 database with the schema attached. */
export const createDb = (d1: D1Database) => drizzle(d1, { schema });
