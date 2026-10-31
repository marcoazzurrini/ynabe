import { createServerFn } from "@tanstack/react-start";
import { assign, categorize, createDb, loadBudget, setTarget } from "@ynabe/db";
import { z } from "zod";

const database = async () => {
  const { env } = await import("cloudflare:workers");

  return createDb(env.DB);
};

/** Everything the budget engine needs, read from D1. */
export const getBudget = createServerFn({ method: "GET" }).handler(async () =>
  loadBudget(await database())
);

const assignInput = z.object({
  amount: z.number().int(),
  categoryId: z.string().min(1),
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u),
});

/** Sets a category's assignment for a month. */
export const saveAssignment = createServerFn({ method: "POST" })
  .validator(assignInput)
  .handler(async ({ data }) => {
    await assign(await database(), data.categoryId, data.month, data.amount);
  });

const categorizeInput = z.object({
  categoryId: z.string().min(1).nullable(),
  transactionId: z.string().min(1),
});

/** Files a transaction under a category. */
export const saveCategory = createServerFn({ method: "POST" })
  .validator(categorizeInput)
  .handler(async ({ data }) => {
    await categorize(await database(), data.transactionId, data.categoryId);
  });

const targetInput = z.object({
  categoryId: z.string().min(1),
  target: z
    .discriminatedUnion("kind", [
      z.object({
        amount: z.number().int().positive(),
        dueDay: z.number().int().min(1).max(31).optional(),
        kind: z.literal("monthly"),
      }),
      z.object({
        amount: z.number().int().positive(),
        by: z
          .string()
          .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/u)
          .optional(),
        kind: z.literal("savings"),
      }),
    ])
    .nullable(),
});

/** Sets or removes a category's target. */
export const saveTarget = createServerFn({ method: "POST" })
  .validator(targetInput)
  .handler(async ({ data }) => {
    await setTarget(await database(), data.categoryId, data.target);
  });
