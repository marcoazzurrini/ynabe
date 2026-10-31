import { QueryClient } from "@tanstack/query-core";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";

import { getBudget, saveAssignment } from "../server/budget";

export const queryClient = new QueryClient();

const budget = () =>
  queryClient.fetchQuery({ queryFn: () => getBudget(), queryKey: ["budget"] });

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

export const categories = createCollection(
  queryCollectionOptions({
    getKey: (category) => category.id,
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
