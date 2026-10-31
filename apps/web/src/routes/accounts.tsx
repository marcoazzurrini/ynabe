import { createFileRoute, Link } from "@tanstack/react-router";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import {
  FileUp,
  Landmark,
  Plus,
  Scale,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AccountMark } from "../components/account-mark";
import type { LedgerRow } from "../components/accounts/ledger";
import { Ledger } from "../components/accounts/ledger";
import { Segmented } from "../components/segmented";
import { Topbar } from "../components/topbar";
import { useBudget } from "../data/use-budget";

type Filter = "all" | "uncleared" | "uncategorized" | "transfers";

const kindLabel = new Map([
  ["card", "Card"],
  ["cash", "Cash"],
  ["checking", "Checking"],
  ["savings", "Savings"],
  ["tracking", "Tracking"],
]);

type Budget = ReturnType<typeof useBudget>;

/** The category this payee is filed under most often. */
const guessFor = (row: Budget["ledger"][number], ledger: Budget["ledger"]) => {
  const counts = new Map<string, number>();

  for (const other of ledger) {
    if (
      other.payee === row.payee &&
      other.categoryId &&
      other.categoryId !== "ready-to-assign"
    ) {
      counts.set(other.categoryId, (counts.get(other.categoryId) ?? 0) + 1);
    }
  }

  return [...counts].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const nameOf = (names: Map<string, string>, id: string | null | undefined) =>
  id ? (names.get(id) ?? null) : null;

/** Joins ledger rows with account, category, and group names, plus a guess. */
const buildRows = ({
  accounts,
  categories,
  groups,
  ledger,
}: Pick<
  Budget,
  "accounts" | "categories" | "groups" | "ledger"
>): LedgerRow[] => {
  const accountName = new Map(
    accounts.map((account) => [account.id, account.name])
  );

  const groupName = new Map(groups.map((group) => [group.id, group.name]));
  const byId = new Map(categories.map((category) => [category.id, category]));

  return ledger.map((row): LedgerRow => {
    const category = row.categoryId ? byId.get(row.categoryId) : undefined;

    const best =
      row.categoryId === null && !row.transferAccountId
        ? guessFor(row, ledger)
        : null;

    return {
      ...row,
      accountName: accountName.get(row.accountId) ?? "",
      categoryIcon: category?.icon ?? null,
      categoryName: category?.name ?? null,
      groupName: nameOf(groupName, category?.groupId),
      guess: best ? (byId.get(best)?.name ?? null) : null,
      transferName: nameOf(accountName, row.transferAccountId),
    };
  });
};

const matchesFilter = (row: LedgerRow, filter: Filter, search: string) => {
  if (
    search !== "" &&
    !`${row.payee} ${row.memo ?? ""} ${row.categoryName ?? ""}`
      .toLowerCase()
      .includes(search)
  ) {
    return false;
  }

  if (filter === "uncleared") {
    return row.cleared === "uncleared";
  }

  if (filter === "uncategorized") {
    return row.categoryId === null && !row.transferAccountId;
  }

  if (filter === "transfers") {
    return row.transferAccountId !== null;
  }

  return true;
};

const AccountsScreen = () => {
  const { account: accountFilter } = Route.useSearch();
  const { accounts, categories, groups, ledger } = useBudget();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => buildRows({ accounts, categories, groups, ledger }),
    [accounts, categories, groups, ledger]
  );

  const balance = (id?: string) =>
    rows
      .filter((row) => id === undefined || row.accountId === id)
      .reduce((sum, row) => sum + row.amount, 0);

  const uncleared = (id?: string) =>
    rows.filter(
      (row) =>
        row.cleared === "uncleared" &&
        (id === undefined || row.accountId === id)
    );

  const inAccount = rows.filter(
    (row) => accountFilter === undefined || row.accountId === accountFilter
  );

  const needsCategory = inAccount.filter(
    (row) => row.categoryId === null && !row.transferAccountId
  );

  const search = query.trim().toLowerCase();

  const visible = inAccount.filter((row) => matchesFilter(row, filter, search));

  const card =
    "flex flex-1 flex-col gap-2 rounded-xl bg-white px-4 py-3.5 shadow-card";

  return (
    <>
      <Topbar
        icon={Landmark}
        title="All Accounts"
        context={`${accounts.length} accounts · ${ledger.length} transactions`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="flex flex-col gap-6 px-10 pt-9 pb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-[40px] leading-[44px] font-semibold tracking-tight">
              Accounts
            </h1>
            <div className="flex gap-2">
              <Button variant="ghost">
                <Scale />
                Reconcile
              </Button>
              <Button variant="outline">
                <FileUp />
                Import
              </Button>
              <Button>
                <Plus />
                Add transaction
              </Button>
            </div>
          </div>
          <div className="flex gap-4">
            <Link
              to="/accounts"
              search={{}}
              className={cn(
                card,
                "flex-[1.2]",
                accountFilter === undefined &&
                  "shadow-[0_0_0_1.5px_var(--text-primary),var(--elevation-card)]"
              )}
            >
              <span className="text-text-secondary flex items-center gap-2 text-[13px] font-medium">
                <span className="flex-1">All accounts</span>
                <span className="text-text-tertiary text-xs">
                  {accounts.length}
                </span>
              </span>
              <Money
                cents={balance()}
                className="text-xl leading-6 font-semibold tracking-tight"
              />
              <span className="text-text-tertiary text-xs font-medium">
                <Money
                  cents={uncleared().reduce((sum, row) => sum + row.amount, 0)}
                />{" "}
                uncleared
              </span>
            </Link>
            {accounts.map((account) => (
              <Link
                key={account.id}
                to="/accounts"
                search={{ account: account.id }}
                className={cn(
                  card,
                  accountFilter === account.id &&
                    "shadow-[0_0_0_1.5px_var(--text-primary),var(--elevation-card)]"
                )}
              >
                <span className="text-text-secondary flex items-center gap-2 text-[13px] font-medium">
                  <AccountMark id={account.id} />
                  <span className="flex-1">{account.name}</span>
                  <span className="text-text-tertiary text-xs">
                    {kindLabel.get(account.kind) ?? account.kind}
                  </span>
                </span>
                <Money
                  cents={balance(account.id)}
                  className="text-xl leading-6 font-semibold tracking-tight"
                />
                <span className="text-text-tertiary text-xs font-medium">
                  {uncleared(account.id).length === 0
                    ? "All cleared"
                    : `${uncleared(account.id).length} uncleared`}
                </span>
              </Link>
            ))}
          </div>
        </section>
        <div className="flex items-center justify-between px-10 pb-2">
          <Segmented
            label="Filter transactions"
            value={filter}
            onChange={setFilter}
            options={[
              { label: "All", value: "all" },
              {
                count: inAccount.filter((row) => row.cleared === "uncleared")
                  .length,
                label: "Uncleared",
                value: "uncleared",
              },
              {
                count: needsCategory.length,
                label: "Needs a category",
                value: "uncategorized",
              },
              { label: "Transfers", value: "transfers" },
            ]}
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost">
              <SlidersHorizontal />
              View
            </Button>
            <label className="border-border-control text-text-tertiary flex h-8 w-[280px] items-center gap-2 rounded-[10px] border bg-white px-2.5 text-[13px] font-medium">
              <Search className="size-3.5" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search transactions"
                className="text-text-primary placeholder:text-text-tertiary flex-1 bg-transparent outline-none"
              />
            </label>
          </div>
        </div>
        <Ledger rows={visible} />
      </div>
    </>
  );
};

export const Route = createFileRoute("/accounts")({
  component: AccountsScreen,
});
