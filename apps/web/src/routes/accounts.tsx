import { createFileRoute, Link } from "@tanstack/react-router";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import { inLedgerFilter, ledgerRows } from "@ynabe/views";
import type { LedgerFilter } from "@ynabe/views";
import {
  CircleCheck,
  FileUp,
  LogOut,
  Plus,
  RefreshCw,
  Scale,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AccountMark } from "../components/account-mark";
import { Ledger } from "../components/accounts/ledger";
import { PhoneLedger } from "../components/phone/ledger";
import { usePhone } from "../components/phone/use-phone";
import { Segmented } from "../components/segmented";
import { setCategory, syncBanks } from "../data/actions";
import { signOut } from "../data/session";
import { useBudget } from "../data/use-budget";

const kindLabel = new Map([
  ["card", "Card"],
  ["cash", "Cash"],
  ["checking", "Checking"],
  ["savings", "Savings"],
  ["tracking", "Tracking"],
]);

/** Asks the banks for new rows and says how many came. */
const SyncButton = () => {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const [added, setAdded] = useState<number | null>(null);

  const run = async () => {
    setState("busy");

    try {
      const report = await syncBanks();

      setAdded(report.added);
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  const label = new Map([
    ["busy", "Syncing…"],
    ["failed", "Sync failed. Try again"],
  ]).get(state);

  return (
    <Button variant="outline" disabled={state === "busy"} onClick={run}>
      <RefreshCw className={cn(state === "busy" && "animate-spin")} />
      {label ?? (added === null ? "Sync banks" : `${added} new · Sync again`)}
    </Button>
  );
};

const ActiveCheck = () => (
  <CircleCheck className="size-4 shrink-0 text-(--blue)" aria-hidden />
);

const AccountsScreen = () => {
  const { account: accountFilter } = Route.useSearch();
  const { accounts, categories, groups, ledger } = useBudget();
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [query, setQuery] = useState("");
  const phone = usePhone();

  const rows = useMemo(
    () => ledgerRows({ accounts, categories, groups, transactions: ledger }),
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
  const open = accounts.filter((account) => !account.closed);

  const visible = inAccount.filter((row) =>
    inLedgerFilter(row, filter, search)
  );

  const selected = accounts.find((account) => account.id === accountFilter);

  const choices = useMemo(
    () =>
      groups.map((group) => ({
        categories: categories.filter((entry) => entry.groupId === group.id),
        id: group.id,
        name: group.name,
      })),
    [categories, groups]
  );

  // On a phone the cards keep their width and scroll sideways.
  const card =
    "flex flex-1 flex-col gap-2 rounded-xl bg-white px-4 py-3.5 shadow-card max-md:min-w-[172px] max-md:flex-none max-md:snap-start max-md:rounded-2xl";

  // The card whose transactions are listed: outlined, tinted, and checked.
  const active =
    "bg-surface-selected shadow-[0_0_0_2px_var(--blue),var(--elevation-card)]";

  const activeName = "text-text-primary font-semibold";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto max-md:pb-28">
      <section className="flex flex-col gap-6 px-10 pt-7 pb-6 max-md:gap-3 max-md:px-4 max-md:pt-4 max-md:pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {selected ? (
              <AccountMark
                id={selected.id}
                name={selected.name}
                className="size-9 rounded-[9px] text-xl"
              />
            ) : null}
            <h1 className="text-[40px] leading-[44px] font-semibold tracking-tight max-md:text-[30px] max-md:leading-9">
              {selected?.name ?? "Accounts"}
            </h1>
            {selected ? (
              <Link
                to="/accounts"
                search={{}}
                className="bg-surface-sunken text-text-secondary ml-1.5 flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap max-md:hidden"
              >
                <X className="size-[13px]" aria-hidden />
                Show all accounts
              </Link>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="max-md:hidden">
              <Scale />
              Reconcile
            </Button>
            <SyncButton />
            <Button variant="outline" className="max-md:hidden">
              <FileUp />
              Import
            </Button>
            <Button className="max-md:hidden">
              <Plus />
              Add transaction
            </Button>
          </div>
        </div>
        <div className="flex gap-4 max-md:-mx-4 max-md:snap-x max-md:[scrollbar-width:none] max-md:gap-3 max-md:overflow-x-auto max-md:px-4 max-md:py-1">
          <Link
            to="/accounts"
            search={{}}
            aria-current={accountFilter === undefined ? "true" : undefined}
            className={cn(
              card,
              "flex-[1.2]",
              accountFilter === undefined && active
            )}
          >
            <span className="text-text-secondary flex items-center gap-2 text-[13px] font-medium">
              <span
                className={cn(
                  "flex-1",
                  accountFilter === undefined && activeName
                )}
              >
                All accounts
              </span>
              <span className="text-text-tertiary text-xs">
                {accounts.length}
              </span>
              {accountFilter === undefined ? <ActiveCheck /> : null}
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
          {open.map((account) => (
            <Link
              key={account.id}
              to="/accounts"
              search={{ account: account.id }}
              aria-current={accountFilter === account.id ? "true" : undefined}
              className={cn(card, accountFilter === account.id && active)}
            >
              <span className="text-text-secondary flex items-center gap-2 text-[13px] font-medium">
                <AccountMark id={account.id} name={account.name} />
                <span
                  className={cn(
                    "flex-1",
                    accountFilter === account.id && activeName
                  )}
                >
                  {account.name}
                </span>
                <span className="text-text-tertiary text-xs">
                  {kindLabel.get(account.kind) ?? account.kind}
                </span>
                {accountFilter === account.id ? <ActiveCheck /> : null}
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
      <div className="flex items-center justify-between gap-3 px-10 pb-2 max-md:flex-col max-md:items-stretch max-md:px-4 max-md:pb-4">
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
          <Button variant="ghost" className="max-md:hidden">
            <SlidersHorizontal />
            View
          </Button>
          <label className="border-border-control text-text-tertiary flex h-8 w-[280px] items-center gap-2 rounded-[10px] border bg-white px-2.5 text-[13px] font-medium max-md:h-10 max-md:w-full max-md:rounded-xl max-md:text-base">
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
      {phone ? (
        <>
          <PhoneLedger
            rows={visible}
            choices={choices}
            onCategorize={setCategory}
          />
          <button
            type="button"
            onClick={signOut}
            className="text-text-tertiary mx-auto mt-8 flex h-10 items-center gap-2 px-4 text-[13px] font-medium"
          >
            <LogOut className="size-3.5" aria-hidden />
            Sign out
          </button>
        </>
      ) : (
        <Ledger rows={visible} />
      )}
    </div>
  );
};

export const Route = createFileRoute("/accounts")({
  component: AccountsScreen,
});
