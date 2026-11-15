import { formatMoney, READY_TO_ASSIGN } from "@ynabe/budget";
import { assign, categorize, setTarget } from "@ynabe/db";
import type { Budget, Database, ProposalLine } from "@ynabe/db";
import { z } from "zod";

const month = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u)
  .describe("A month, written YYYY-MM");

const target = z.discriminatedUnion("kind", [
  z.object({
    amount: z.number().int().positive(),
    dueDay: z.number().int().min(1).max(31).optional(),
    kind: z.literal("monthly"),
  }),
  z.object({
    amount: z.number().int().positive(),
    by: month.optional(),
    kind: z.literal("savings"),
  }),
]);

/** One change the assistant can propose. Amounts are whole cents. */
export const change = z.discriminatedUnion("kind", [
  z.object({
    categoryId: z
      .string()
      .min(1)
      .nullable()
      .describe(
        `The category id, "${READY_TO_ASSIGN}" for income, or null to clear it`
      ),
    kind: z.literal("categorize"),
    transactionId: z.string().min(1),
  }),
  z.object({
    amount: z
      .number()
      .int()
      .describe("The new total assigned for that month, not a difference"),
    categoryId: z.string().min(1),
    kind: z.literal("assign"),
    month,
  }),
  z.object({
    categoryId: z.string().min(1),
    kind: z.literal("target"),
    target: target.nullable().describe("The new target, or null to remove it"),
  }),
]);

export type Change = z.infer<typeof change>;

interface Described {
  lines: ProposalLine[];
  /** Why the changes cannot be proposed. Empty when they all can. */
  problems: string[];
}

const targetText = (value: Extract<Change, { kind: "target" }>["target"]) => {
  if (!value) {
    return "No target";
  }

  return value.kind === "monthly"
    ? `${formatMoney(value.amount)} a month`
    : `${formatMoney(value.amount)} saved`;
};

/** Checks changes against the budget and words them for the app. */
export const describeChanges = (
  budget: Budget,
  changes: readonly Change[]
): Described => {
  const lines: ProposalLine[] = [];
  const problems: string[] = [];

  const categoryOf = (id: string) =>
    budget.categories.find((category) => category.id === id);

  for (const item of changes) {
    if (item.kind === "categorize") {
      const row = budget.transactions.find(
        (transaction) => transaction.id === item.transactionId
      );

      const category =
        item.categoryId === null || item.categoryId === READY_TO_ASSIGN
          ? null
          : categoryOf(item.categoryId);

      if (!row) {
        problems.push(`No transaction has the id ${item.transactionId}`);
      } else if (category === undefined) {
        problems.push(`No category has the id ${item.categoryId}`);
      } else {
        let value = category?.name ?? "No category";

        if (item.categoryId === READY_TO_ASSIGN) {
          value = "Ready to Assign";
        }

        lines.push({
          icon: category?.icon ?? null,
          label: `${row.payee} · ${formatMoney(row.amount)}`,
          value,
        });
      }
    } else {
      const category = categoryOf(item.categoryId);

      if (!category) {
        problems.push(`No category has the id ${item.categoryId}`);
      } else if (item.kind === "assign") {
        const current =
          budget.assignments.find(
            (assignment) =>
              assignment.categoryId === item.categoryId &&
              assignment.month === item.month
          )?.amount ?? 0;

        lines.push({
          icon: category.icon,
          label: `${category.name} · ${item.month}`,
          positive: item.amount > current,
          value: formatMoney(item.amount - current, { sign: true }),
        });
      } else {
        lines.push({
          icon: category.icon,
          label: `${category.name} target`,
          value: targetText(item.target),
        });
      }
    }
  }

  return { lines, problems };
};

const make = (db: Database, item: Change): Promise<void> => {
  if (item.kind === "categorize") {
    return categorize(db, item.transactionId, item.categoryId);
  }

  return item.kind === "assign"
    ? assign(db, item.categoryId, item.month, item.amount)
    : setTarget(db, item.categoryId, item.target);
};

/** Makes the changes of a proposal, one after the other. */
export const applyChanges = async (
  db: Database,
  changes: readonly Change[]
): Promise<void> => {
  for (const item of changes) {
    // oxlint-disable-next-line no-await-in-loop -- a later change may build on an earlier one
    await make(db, item);
  }
};
