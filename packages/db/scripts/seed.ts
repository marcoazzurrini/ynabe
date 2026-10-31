/**
 * Writes seed.sql: a sample budget that mirrors the penna design, with six
 * months of history so Reflect has something to compare. Run with
 * `bun run --cwd packages/db seed:generate`.
 */

import { planMonth } from "@ynabe/budget";
import type { Transaction } from "@ynabe/budget";

interface CategorySeed {
  id: string;
  name: string;
  icon: string;
  target?: {
    kind: "monthly" | "savings";
    amount: number;
    by?: string;
    dueDay?: number;
  };
}

const groups: { id: string; name: string; categories: CategorySeed[] }[] = [
  {
    categories: [
      { icon: "hammer", id: "home-improvement", name: "Home Improvement" },
      {
        icon: "shield",
        id: "work-replacement",
        name: "6 Months Work Replacement",
        target: { amount: 750_000, kind: "savings" },
      },
      {
        icon: "rocket",
        id: "entrepreneurship",
        name: "Entrepreneurship Project",
        target: { amount: 2_000_000, kind: "savings" },
      },
      {
        icon: "mountain",
        id: "experiences",
        name: "Experiences",
        target: { amount: 300_000, by: "2026-12", kind: "savings" },
      },
    ],
    id: "savings-goals",
    name: "Savings Goals",
  },
  {
    categories: [
      {
        icon: "file-badge",
        id: "diritto-annuale",
        name: "Diritto Annuale",
        target: { amount: 2500, kind: "monthly" },
      },
      {
        icon: "mail-check",
        id: "pec",
        name: "PEC",
        target: { amount: 1200, kind: "monthly" },
      },
      {
        icon: "landmark",
        id: "inps",
        name: "INPS",
        target: { amount: 1_052_476, kind: "savings" },
      },
      {
        icon: "percent",
        id: "aliquota",
        name: "Aliquota",
        target: { amount: 193_334, kind: "savings" },
      },
      {
        icon: "receipt",
        id: "fiscozen",
        name: "Fiscozen",
        target: { amount: 40_000, kind: "savings" },
      },
      {
        icon: "hard-hat",
        id: "inail",
        name: "INAIL",
        target: { amount: 10_000, kind: "savings" },
      },
    ],
    id: "business",
    name: "Business",
  },
  {
    categories: [
      {
        icon: "house",
        id: "rent",
        name: "Rent",
        target: { amount: 45_000, dueDay: 25, kind: "monthly" },
      },
      { icon: "car", id: "car-revisione", name: "Car · Revisione" },
      { icon: "trash-2", id: "tari", name: "TARI" },
      {
        icon: "wrench",
        id: "home-maintenance",
        name: "Home Maintenance",
        target: { amount: 27_785, kind: "monthly" },
      },
      {
        icon: "zap",
        id: "energy",
        name: "Energy",
        target: { amount: 6200, kind: "monthly" },
      },
      {
        icon: "flame",
        id: "gas",
        name: "Gas",
        target: { amount: 8400, kind: "monthly" },
      },
      { icon: "droplet", id: "water", name: "Water" },
      {
        icon: "smartphone",
        id: "phone",
        name: "Phone",
        target: { amount: 500, kind: "monthly" },
      },
      {
        icon: "wifi",
        id: "internet",
        name: "Internet",
        target: { amount: 1000, dueDay: 21, kind: "monthly" },
      },
      {
        icon: "car-front",
        id: "auto-maintenance",
        name: "Auto maintenance",
        target: { amount: 5000, kind: "monthly" },
      },
      {
        icon: "fuel",
        id: "fuel",
        name: "Fuel",
        target: { amount: 6000, kind: "monthly" },
      },
      {
        icon: "umbrella",
        id: "ombra",
        name: "Ombra",
        target: { amount: 2500, kind: "monthly" },
      },
    ],
    id: "bills",
    name: "Bills",
  },
  {
    categories: [
      {
        icon: "utensils",
        id: "eating-out",
        name: "Eating Out",
        target: { amount: 12_000, kind: "monthly" },
      },
      { icon: "sparkles", id: "new-stuff", name: "New Stuff" },
      {
        icon: "scissors",
        id: "haircuts",
        name: "Haircuts",
        target: { amount: 3000, kind: "monthly" },
      },
    ],
    id: "entertainment",
    name: "Entertainment",
  },
  {
    categories: [
      {
        icon: "pill",
        id: "supplements",
        name: "Supplements",
        target: { amount: 3000, kind: "monthly" },
      },
    ],
    id: "health",
    name: "Health",
  },
  {
    categories: [
      {
        icon: "code",
        id: "supermaven",
        name: "Supermaven",
        target: { amount: 892, kind: "monthly" },
      },
      {
        icon: "wallet",
        id: "budgeting",
        name: "Budgeting",
        target: { amount: 1344, kind: "monthly" },
      },
      {
        icon: "cloud",
        id: "aws",
        name: "AWS",
        target: { amount: 55, kind: "monthly" },
      },
    ],
    id: "subscriptions",
    name: "Subscriptions",
  },
];

// A small seeded generator keeps the seed the same on every run.
let state = 7;

const random = () => {
  state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;

  return state / 2_147_483_648;
};

const between = (low: number, high: number) =>
  Math.round(low + random() * (high - low));

const text = (value: string | null | undefined) =>
  value === null || value === undefined
    ? "NULL"
    : `'${value.replaceAll("'", "''")}'`;

const number = (value: number | null | undefined) =>
  value === null || value === undefined ? "NULL" : String(value);

const months = [
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
];

const transactions: string[] = [];
const ledger: Transaction[] = [];
const assignments: [string, string, number][] = [];
let next = 0;

const spend = (
  date: string,
  payee: string,
  amount: number,
  categoryId: string | null,
  options: {
    account?: string;
    memo?: string;
    cleared?: string;
    transfer?: string;
  } = {}
) => {
  next += 1;
  ledger.push({
    amount,
    categoryId,
    date,
    id: String(next),
    transfer: options.transfer !== undefined,
  });
  transactions.push(
    [
      text(`t${String(next).padStart(4, "0")}`),
      text(options.account ?? "revolut"),
      text(date),
      text(payee),
      text(options.memo),
      number(amount),
      text(categoryId),
      text(options.cleared ?? "reconciled"),
      text(options.transfer),
    ].join(", ")
  );
};

spend("2026-04-01", "Opening balance", 3_950_000, "ready-to-assign", {
  account: "illimity",
});

spend("2026-04-01", "Opening balance", 30_400, "ready-to-assign", {
  account: "tinaba",
});

const eatingOut = [
  "Coop",
  "KFC",
  "Trattoria da Gino",
  "Bar Centrale",
  "Esselunga",
];

for (const [index, month] of months.entries()) {
  const october = month === "2026-10";
  const cleared = october ? "cleared" : "reconciled";

  spend(`${month}-27`, "Studio Rossi", 325_000, "ready-to-assign", {
    account: "tinaba",
    cleared,
    memo: "Salary",
  });

  for (const group of groups) {
    for (const category of group.categories) {
      if (
        category.target?.kind === "monthly" &&
        !(october && ["home-maintenance", "rent"].includes(category.id))
      ) {
        let { amount } = category.target;

        if (october && category.id === "internet") {
          amount = 500;
        } else if (october && category.id === "fuel") {
          amount = 4000;
        }

        assignments.push([category.id, month, amount]);
      }
    }
  }

  if (!october) {
    spend(`${month}-02`, "Silvano Gambini", -45_000, "rent", {
      account: "illimity",
      memo: "Rent",
    });
  }

  spend(
    `${month}-${String(between(10, 20)).padStart(2, "0")}`,
    "Enel",
    -6200,
    "energy",
    { cleared }
  );
  spend(
    `${month}-${String(between(10, 20)).padStart(2, "0")}`,
    "Eni Plenitude",
    -8400,
    "gas",
    { cleared }
  );
  spend(`${month}-03`, "Postemobile", -500, "phone", { cleared });
  spend(`${month}-03`, "Supermaven", -892, "supermaven", { cleared });
  spend(`${month}-03`, "YNAB", -1344, "budgeting", { cleared });
  spend(`${month}-02`, "AWS", -55, "aws", { cleared });
  spend(
    `${month}-${String(between(5, 25)).padStart(2, "0")}`,
    "Bancomat",
    -between(3000, 5500),
    "fuel",
    { cleared }
  );

  const meals = october ? 7 : between(4, 6);
  let eaten = 0;

  for (let meal = 0; meal < meals; meal += 1) {
    const day = String(between(1, 30)).padStart(2, "0");
    const payee = eatingOut[between(0, eatingOut.length - 1)] ?? "Coop";
    const cost = between(october ? 1800 : 1200, october ? 3200 : 2800);

    eaten += cost;
    spend(`${month}-${day}`, payee, -cost, "eating-out", {
      cleared: october && meal > 4 ? "uncleared" : cleared,
    });
  }

  // Eating Out spends everything it gets, so October's extra shows.
  if (!october) {
    assignments.push(["eating-out", month, eaten - 12_000]);
  }

  spend(
    `${month}-${String(between(8, 22)).padStart(2, "0")}`,
    "Barbiere",
    -1500,
    "haircuts",
    { cleared }
  );
  spend(
    `${month}-${String(between(4, 26)).padStart(2, "0")}`,
    "OBI",
    -between(500, 4000),
    "new-stuff",
    { cleared, memo: index % 2 === 0 ? "chiavi palazzuolo" : undefined }
  );
  spend(
    `${month}-${String(between(4, 26)).padStart(2, "0")}`,
    "Amazon",
    -between(1500, 3000),
    "supplements",
    { cleared, memo: "magnesio" }
  );

  if (index > 1) {
    assignments.push(
      ["entrepreneurship", month, 50_000],
      ["experiences", month, 15_000]
    );
  }
}

assignments.push(
  ["work-replacement", "2026-04", 750_000],
  ["inps", "2026-04", 1_052_476],
  ["aliquota", "2026-04", 193_334],
  ["fiscozen", "2026-04", 40_000],
  ["inail", "2026-04", 10_000],
  ["entrepreneurship", "2026-04", 1_250_000],
  ["experiences", "2026-04", 222_000],
  ["car-revisione", "2026-04", 2170],
  ["new-stuff", "2026-10", 6000]
);

spend("2026-09-14", "Associazione Intento", -42_000, "experiences", {
  account: "illimity",
});

spend("2026-10-27", "Associazione Intento", -42_000, "experiences", {
  account: "illimity",
  cleared: "cleared",
});

spend("2026-10-12", "Aruba", -1050, "pec", {
  cleared: "cleared",
  memo: "PEC renewal",
});

spend("2026-09-29", "TARI", -11_900, "tari", { account: "illimity" });

spend("2026-10-29", "EasyPark", -199, null, { cleared: "uncleared" });

spend("2026-10-28", "Coop", -130, null, { cleared: "uncleared" });

spend("2026-10-30", "Transfer to Revolut", -10_000, null, {
  account: "illimity",
  cleared: "cleared",
  transfer: "revolut",
});

spend("2026-10-30", "Transfer from Illimity", 10_000, null, {
  cleared: "cleared",
  transfer: "illimity",
});

const lines = [
  "-- Generated by scripts/seed.ts. Load with `bun run --cwd apps/web db:seed`.",
  "DELETE FROM transactions;",
  "DELETE FROM assignments;",
  "DELETE FROM categories;",
  "DELETE FROM category_groups;",
  "DELETE FROM accounts;",
  "INSERT INTO accounts (id, name, kind) VALUES ('illimity', 'Illimity', 'checking'), ('tinaba', 'Tinaba', 'savings'), ('revolut', 'Revolut', 'card'), ('monzo', 'Monzo', 'card');",
];

for (const [position, group] of groups.entries()) {
  lines.push(
    `INSERT INTO category_groups (id, name, position) VALUES (${text(group.id)}, ${text(group.name)}, ${position});`
  );

  for (const [index, category] of group.categories.entries()) {
    const { target } = category;

    lines.push(
      `INSERT INTO categories (id, group_id, name, icon, position, target_kind, target_amount, target_by, target_due_day) VALUES (${[
        text(category.id),
        text(group.id),
        text(category.name),
        text(category.icon),
        number(index),
        text(target?.kind),
        number(target?.amount),
        text(target?.by),
        number(target?.dueDay),
      ].join(", ")});`
    );
  }
}

// Park the rest of the opening balance in Home Improvement, so Ready to
// Assign shows the 421.76€ the design starts from.
const budgetCategories = groups.flatMap((group) =>
  group.categories.map((category) => ({
    groupId: group.id,
    id: category.id,
    name: category.name,
    target: category.target,
  }))
);

const plan = planMonth(
  {
    assignments: assignments.map(([categoryId, month, amount]) => ({
      amount,
      categoryId,
      month,
    })),
    categories: budgetCategories,
    transactions: ledger,
  },
  "2026-10"
);

assignments.push(["home-improvement", "2026-04", plan.readyToAssign - 42_176]);

const summed = new Map<string, number>();

for (const [categoryId, month, amount] of assignments) {
  summed.set(
    `${categoryId}|${month}`,
    (summed.get(`${categoryId}|${month}`) ?? 0) + amount
  );
}

for (const [key, amount] of summed) {
  const [categoryId = "", month = ""] = key.split("|");

  lines.push(
    `INSERT INTO assignments (category_id, month, amount) VALUES (${text(categoryId)}, ${text(month)}, ${amount});`
  );
}

for (const row of transactions) {
  lines.push(
    `INSERT INTO transactions (id, account_id, date, payee, memo, amount, category_id, cleared, transfer_account_id) VALUES (${row});`
  );
}

await Bun.write(
  new URL("../seed.sql", import.meta.url),
  `${lines.join("\n")}\n`
);
