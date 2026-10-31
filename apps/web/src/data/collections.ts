import { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";

import {
  getBudget,
  saveAssignment,
  saveCategory,
  saveTarget,
} from "../server/budget";
import { checkSession } from "./session";

export const queryClient = new QueryClient();

/** Loads the budget; a refused request means the session ended. */
const budget = async () => {
  try {
    return await queryClient.fetchQuery({
      queryFn: () => getBudget(),
      queryKey: ["budget"],
    });
  } catch (error) {
    await checkSession();
    throw error;
  }
};

export const accounts = createCollection(
  queryCollectionOptions({
    getKey: (account) => account.id,
    queryClient,
    queryFn: async () => {
      const data = await budget();

      return data.accounts;
    },
    queryKey: ["budget", "accounts"],
  })
);

export const groups = createCollection(
  queryCollectionOptions({
    getKey: (group) => group.id,
    queryClient,
    queryFn: async () => {
      const data = await budget();

      return data.groups;
    },
    queryKey: ["budget", "groups"],
  })
);

export const categories = createCollection(
  queryCollectionOptions({
    getKey: (category) => category.id,
    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(({ modified }) =>
          saveTarget({
            data: { categoryId: modified.id, target: modified.target ?? null },
          })
        )
      );
    },
    queryClient,
    queryFn: async () => {
      const data = await budget();

      return data.categories;
    },
    queryKey: ["budget", "categories"],
  })
);

export const transactions = createCollection(
  queryCollectionOptions({
    getKey: (transaction) => transaction.id,
    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(({ modified }) =>
          saveCategory({
            data: {
              categoryId: modified.categoryId,
              transactionId: modified.id,
            },
          })
        )
      );
    },
    queryClient,
    queryFn: async () => {
      const data = await budget();

      return data.transactions;
    },
    queryKey: ["budget", "transactions"],
  })
);

/**
 * Assignments update optimistically: the Plan screen changes at once and
 * the server function persists the new amount behind it.
 */
export const assignments = createCollection(
  queryCollectionOptions({
    getKey: (assignment) => `${assignment.categoryId}:${assignment.month}`,
    onInsert: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(({ modified }) =>
          saveAssignment({ data: modified })
        )
      );
    },
    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(({ modified }) =>
          saveAssignment({ data: modified })
        )
      );
    },
    queryClient,
    queryFn: async () => {
      const data = await budget();

      return data.assignments;
    },
    queryKey: ["budget", "assignments"],
  })
);
