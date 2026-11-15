import type { ImportedTransaction } from "./ynab.ts";

/** A standing choice: rows from these payees belong in this category. */
export interface Rule {
  /** A category id, or `ready-to-assign` for income. */
  category: string;
  /** Payees, or the bank's text for them, matched whole. Case does not matter. */
  payees?: readonly string[];
  /** Pieces of the payee or the bank's text, for payees that vary. */
  contains?: readonly string[];
  /** Limit the rule to money coming in or going out. */
  only?: "in" | "out";
}

export interface Ruled {
  transactions: ImportedTransaction[];
  /** Rows whose category a rule set or changed. */
  filed: number;
}

const fits = ({ only }: Rule, amount: number) =>
  only === undefined || (only === "in" ? amount > 0 : amount < 0);

/**
 * Files new rows by rule. A rule is a choice the person made, so it also
 * replaces a category guessed from past habits. Transfers are left alone.
 * A row is matched by its payee and by the bank's text kept in its memo.
 * A whole match beats a partial one, and among equals the first rule wins.
 */
export const applyRules = (
  transactions: readonly ImportedTransaction[],
  rules: readonly Rule[]
): Ruled => {
  let filed = 0;

  const ruled = transactions.map((row) => {
    if (row.transferAccountId !== null) {
      return row;
    }

    const texts = [row.payee, row.memo ?? ""].map((text) => text.toLowerCase());
    const open = rules.filter((rule) => fits(rule, row.amount));

    const rule =
      open.find(({ payees = [] }) =>
        payees.some((name) => texts.includes(name.toLowerCase()))
      ) ??
      open.find(({ contains = [] }) =>
        contains.some((piece) =>
          texts.some((text) => text.includes(piece.toLowerCase()))
        )
      );

    if (!rule || rule.category === row.categoryId) {
      return row;
    }

    filed += 1;

    return { ...row, categoryId: rule.category };
  });

  return { filed, transactions: ruled };
};
