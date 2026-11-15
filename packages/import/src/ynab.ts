import { parseMoney, READY_TO_ASSIGN } from "@ynabe/budget";
import type { Assignment, Cents, Month } from "@ynabe/budget";

import { parseCsv } from "./csv.ts";

export interface ImportedAccount {
  id: string;
  name: string;
}

export interface ImportedGroup {
  id: string;
  name: string;
  position: number;
}

export interface ImportedCategory {
  id: string;
  groupId: string;
  name: string;
  position: number;
}

export interface ImportedTransaction {
  id: string;
  accountId: string;
  /** `YYYY-MM-DD` */
  date: string;
  payee: string;
  memo: string | null;
  amount: Cents;
  categoryId: string | null;
  cleared: "uncleared" | "cleared" | "reconciled";
  transferAccountId: string | null;
}

/** What YNAB showed as a category's balance at the end of a month. */
export interface ImportedBalance {
  categoryId: string;
  month: Month;
  available: Cents;
}

export interface ImportedBudget {
  accounts: ImportedAccount[];
  groups: ImportedGroup[];
  categories: ImportedCategory[];
  assignments: Assignment[];
  transactions: ImportedTransaction[];
  /** YNAB's own balances, to check the import against. */
  balances: ImportedBalance[];
}

const INCOME = "Inflow: Ready to Assign";
const TRANSFER = "Transfer : ";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const slug = (name: string) =>
  name
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-|-$/gu, "") || "item";

/** Hands out one id per name, adding a number when two names collide. */
const idsFor = (reserved: string[] = []) => {
  const byName = new Map<string, string>();
  const taken = new Set(reserved);

  return (name: string): string => {
    const known = byName.get(name);

    if (known) {
      return known;
    }

    const base = slug(name);
    let id = base;

    for (let count = 2; taken.has(id); count += 1) {
      id = `${base}-${count}`;
    }

    taken.add(id);
    byName.set(name, id);

    return id;
  };
};

const fail = (file: string, row: number, problem: string): never => {
  // The row number, not its contents: imports hold private data.
  throw new Error(`${file}, row ${row + 2}: ${problem}`);
};

const money = (value: string, file: string, row: number): Cents =>
  parseMoney(value) ?? fail(file, row, "an amount is not a number");

/** `Nov 2026` to `2026-11`. */
const monthFrom = (value: string, row: number): Month => {
  const [name = "", year = ""] = value.split(" ");
  const index = MONTHS.indexOf(name);

  if (index === -1 || !/^\d{4}$/u.test(year)) {
    return fail("Plan", row, "the month is not like `Nov 2026`");
  }

  return `${year}-${String(index + 1).padStart(2, "0")}`;
};

type DateOrder = "dmy" | "mdy" | "ymd";

const dateParts = (value: string) =>
  value.split(/[/.-]/u).map((part) => part.trim());

/** YNAB writes dates the way the budget is set up, so look before reading. */
const dateOrderOf = (dates: string[]): DateOrder => {
  const parts = dates.map(dateParts);

  if (parts.every(([first = ""]) => first.length === 4)) {
    return "ymd";
  }

  return parts.some(([, second]) => Number(second) > 12) ? "mdy" : "dmy";
};

const dateFrom = (value: string, order: DateOrder, row: number): string => {
  const [a = "", b = "", c = ""] = dateParts(value);
  let parts = [c, b, a];

  if (order === "mdy") {
    parts = [c, a, b];
  } else if (order === "ymd") {
    parts = [a, b, c];
  }

  const [year = "", month = "", day = ""] = parts;
  const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;

  if (!/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u.test(date)) {
    return fail("Register", row, "the date is not a day, month, and year");
  }

  return date;
};

const clearedFrom = (value: string, row: number) => {
  const cleared = value.toLowerCase();

  if (
    cleared === "uncleared" ||
    cleared === "cleared" ||
    cleared === "reconciled"
  ) {
    return cleared;
  }

  return fail("Register", row, "the cleared state is not one YNAB writes");
};

/** Collects groups and categories in the order YNAB lists them. */
const categoryBook = () => {
  const groupId = idsFor();
  const categoryId = idsFor([READY_TO_ASSIGN]);
  const groups = new Map<string, ImportedGroup>();
  const categories = new Map<string, ImportedCategory>();

  /** The id for a `Group: Category` pair, adding both when they are new. */
  return {
    categories,
    groups,
    idOf: (groupName: string, name: string): string => {
      const group = groups.get(groupName) ?? {
        id: groupId(groupName),
        name: groupName,
        position: groups.size,
      };

      groups.set(groupName, group);

      const key = `${groupName}: ${name}`;

      const category = categories.get(key) ?? {
        groupId: group.id,
        id: categoryId(key),
        name,
        position: [...categories.values()].filter(
          (other) => other.groupId === group.id
        ).length,
      };

      categories.set(key, category);

      return category.id;
    },
  };
};

/**
 * Reads a YNAB export (its Register and Plan CSV files) into the rows
 * ynabe stores. Targets, account types, and flags are not in the export.
 */
export const readYnab = (
  registerCsv: string,
  planCsv: string
): ImportedBudget => {
  const register = parseCsv(registerCsv);
  const plan = parseCsv(planCsv);
  const book = categoryBook();
  const accountId = idsFor();
  const assignments: Assignment[] = [];
  const balances: ImportedBalance[] = [];

  for (const [row, line] of plan.entries()) {
    const categoryId = book.idOf(
      line["Category Group"] ?? "",
      line.Category ?? ""
    );

    const month = monthFrom(line.Month ?? "", row);
    const amount = money(line.Assigned ?? "", "Plan", row);

    if (amount !== 0) {
      assignments.push({ amount, categoryId, month });
    }

    balances.push({
      available: money(line.Available ?? "", "Plan", row),
      categoryId,
      month,
    });
  }

  const accounts = new Map<string, ImportedAccount>();

  // Every account first, so a transfer can name one that comes later.
  for (const line of register) {
    const name = line.Account ?? "";

    accounts.set(name, { id: accountId(name), name });
  }

  const order = dateOrderOf(register.map((line) => line.Date ?? ""));

  const transactions = register.map((line, row): ImportedTransaction => {
    const payee = line.Payee ?? "";
    const category = line["Category Group/Category"] ?? "";

    const amount =
      money(line.Inflow ?? "", "Register", row) -
      money(line.Outflow ?? "", "Register", row);

    const other = payee.startsWith(TRANSFER)
      ? accounts.get(payee.slice(TRANSFER.length))
      : undefined;

    let categoryId: string | null = null;

    if (category === INCOME) {
      categoryId = READY_TO_ASSIGN;
    } else if (category !== "") {
      categoryId = book.idOf(line["Category Group"] ?? "", line.Category ?? "");
    }

    let shownPayee = payee;

    if (other) {
      shownPayee = `Transfer ${amount < 0 ? "to" : "from"} ${other.name}`;
    }

    return {
      accountId: accountId(line.Account ?? ""),
      amount,
      categoryId,
      cleared: clearedFrom(line.Cleared ?? "", row),
      date: dateFrom(line.Date ?? "", order, row),
      id: `ynab-${String(row + 1).padStart(5, "0")}`,
      memo: line.Memo === "" ? null : (line.Memo ?? null),
      payee: shownPayee,
      transferAccountId: other?.id ?? null,
    };
  });

  return {
    accounts: [...accounts.values()],
    assignments,
    balances,
    categories: [...book.categories.values()],
    groups: [...book.groups.values()],
    transactions,
  };
};
