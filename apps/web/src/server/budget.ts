import { createServerFn } from "@tanstack/react-start";
import { assign, createDb, loadBudget } from "@ynabe/db";
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
