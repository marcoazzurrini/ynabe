import type { Cents, Target } from "@ynabe/budget";

import { assignments, categories, transactions } from "./collections";

/** Sets a category's assignment for a month; the screen updates at once. */
export const setAssigned = (
  categoryId: string,
  month: string,
  amount: Cents
): void => {
  const key: `${string}:${string}` = `${categoryId}:${month}`;

  if (assignments.has(key)) {
    assignments.update(key, (draft) => {
      draft.amount = amount;
    });

    return;
  }

  assignments.insert({ amount, categoryId, month });
};

export const setCategory = (
  transactionId: string,
  categoryId: string | null
): void => {
  transactions.update(transactionId, (draft) => {
    draft.categoryId = categoryId;
  });
};

export const updateTarget = (categoryId: string, target: Target): void => {
  categories.update(categoryId, (draft) => {
    draft.target = target;
  });
};
