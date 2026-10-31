import { useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import { READY_TO_ASSIGN } from "@ynabe/budget";
import type { LedgerTransaction } from "@ynabe/db";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import { Plus, Tag } from "lucide-react";

import { accounts, categories, transactions } from "../data/collections";

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_300px_170px_150px_16px] items-center gap-x-6";

const dayTitle = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });

const AccountsScreen = () => {
  const { data: ledger } = useLiveQuery((q) =>
    q.from({ transaction: transactions })
  );

  const { data: accountRows } = useLiveQuery((q) =>
    q.from({ account: accounts })
  );

  const { data: categoryRows } = useLiveQuery((q) =>
    q.from({ category: categories })
  );

  const accountName = new Map(accountRows.map((row) => [row.id, row.name]));
  const categoryName = new Map(categoryRows.map((row) => [row.id, row.name]));
  const days = new Map<string, LedgerTransaction[]>();

  for (const transaction of ledger.toSorted((a, b) =>
    b.date.localeCompare(a.date)
  )) {
    days.set(transaction.date, [
      ...(days.get(transaction.date) ?? []),
      transaction,
    ]);
  }

  const balance = ledger.reduce((total, row) => total + row.amount, 0);

  return (
    <div className="flex flex-col">
      <section className="flex items-end justify-between px-10 pt-9 pb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-[40px] leading-[44px] font-semibold tracking-tight">
            Accounts
          </h1>
          <p className="text-text-tertiary text-sm font-medium">
            Working balance{" "}
            <Money cents={balance} className="text-text-primary" />
          </p>
        </div>
        <Button>
          <Plus />
          Add transaction
        </Button>
      </section>
      <section className="px-7">
        <div
          className={`${COLUMNS} border-border-subtle text-text-tertiary h-8 border-b px-3 text-xs font-medium`}
        >
          <span>Payee</span>
          <span>Category</span>
          <span>Account</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        {[...days].map(([date, rows]) => (
          <div key={date} className="mt-3">
            <h2 className="flex h-9 items-center justify-between px-3 text-[13px] font-semibold">
              <span>{dayTitle(date)}</span>
              <Money
                cents={rows.reduce((total, row) => total + row.amount, 0)}
                sign
                className="text-text-tertiary pr-[52px] font-medium"
              />
            </h2>
            {rows.map((row) => {
              const income = row.categoryId === READY_TO_ASSIGN;

              let category = (
                <span className="text-text-secondary text-[13px]">
                  {row.categoryId
                    ? (categoryName.get(row.categoryId) ?? "")
                    : ""}
                </span>
              );

              if (income) {
                category = (
                  <span className="text-text-secondary text-[13px]">
                    Ready to Assign
                  </span>
                );
              } else if (row.transferAccountId) {
                category = (
                  <span className="text-text-tertiary text-[13px]">
                    Transfer · {accountName.get(row.transferAccountId) ?? ""}
                  </span>
                );
              } else if (row.categoryId === null) {
                category = (
                  <span className="bg-under-bg text-under inline-flex h-6 w-fit items-center gap-1 rounded-[7px] px-2 text-xs font-medium">
                    <Tag className="size-3" />
                    Needs a category
                  </span>
                );
              }

              return (
                <div
                  key={row.id}
                  className={`${COLUMNS} hover:bg-surface-app h-11 rounded-[10px] px-3 text-sm font-medium`}
                >
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="whitespace-nowrap">{row.payee}</span>
                    {row.memo ? (
                      <span className="text-text-tertiary truncate text-[13px]">
                        {row.memo}
                      </span>
                    ) : null}
                  </span>
                  {category}
                  <span className="text-text-secondary text-[13px]">
                    {accountName.get(row.accountId) ?? ""}
                  </span>
                  <Money
                    cents={row.amount}
                    sign
                    className={cn(
                      "text-right font-semibold",
                      income && "text-inflow"
                    )}
                  />
                  <span
                    title={row.cleared}
                    className={cn(
                      "size-2 justify-self-center rounded-full",
                      row.cleared === "uncleared" &&
                        "ring-[1.5px] ring-gray-400 ring-inset"
                    )}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
};

export const Route = createFileRoute("/accounts")({
  component: AccountsScreen,
});
