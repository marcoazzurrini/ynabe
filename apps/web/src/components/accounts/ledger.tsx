import type { LedgerTransaction } from "@ynabe/db";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import {
  ArrowLeftRight,
  ArrowDownLeft,
  CalendarDays,
  ChevronDown,
  Split,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { AccountMark } from "../account-mark";
import { CategoryIcon } from "../category-icon";

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_300px_170px_150px_16px] items-center gap-x-6";

export interface LedgerRow extends LedgerTransaction {
  accountName: string;
  categoryName: string | null;
  categoryIcon: string | null;
  groupName: string | null;
  transferName: string | null;
  /** A likely category for a transaction that has none, from its payee. */
  guess: string | null;
}

const dayTitle = (date: string) => {
  const today = new Date().toISOString().slice(0, 10);

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });

  return date === today ? `Today, ${label.split(", ")[1] ?? label}` : label;
};

const Category = ({ row }: { row: LedgerRow }) => {
  if (row.categoryId === "ready-to-assign") {
    return (
      <span className="flex items-center gap-2 text-[13px]">
        <ArrowDownLeft className="text-funded size-3.5" aria-hidden />
        <span className="text-text-secondary">Ready to Assign</span>
        <span className="text-text-disabled">Inflow</span>
      </span>
    );
  }

  if (row.transferAccountId) {
    return (
      <span className="text-text-tertiary flex items-center gap-2 text-[13px]">
        <ArrowLeftRight className="size-3.5" aria-hidden />
        Transfer · {row.transferName}
      </span>
    );
  }

  if (row.categoryId === null) {
    return (
      <span className="flex items-center gap-2 text-[13px]">
        <span className="bg-under-bg text-under inline-flex h-6 items-center gap-1 rounded-[7px] px-2 text-xs font-medium">
          <Tag className="size-3" aria-hidden />
          Needs a category
        </span>
        {row.guess ? (
          <span className="text-text-tertiary">{row.guess}?</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-2 text-[13px]">
      <CategoryIcon name={row.categoryIcon} className="size-3.5" />
      <span className="text-text-secondary whitespace-nowrap">
        {row.categoryName}
      </span>
      <span className="text-text-disabled truncate">{row.groupName}</span>
    </span>
  );
};

const Line = ({
  row,
  onSelect,
  selected,
}: {
  row: LedgerRow;
  onSelect: () => void;
  selected: boolean;
}) => (
  <button
    type="button"
    onClick={onSelect}
    aria-expanded={selected}
    className={cn(
      COLUMNS,
      "h-11 w-full rounded-[10px] px-3 text-left text-sm font-medium",
      !selected && "hover:bg-surface-app"
    )}
  >
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="whitespace-nowrap">{row.payee}</span>
      {row.memo ? (
        <span className="text-text-tertiary truncate text-[13px]">
          {row.memo}
        </span>
      ) : null}
    </span>
    <Category row={row} />
    <span className="text-text-secondary flex items-center gap-2 text-[13px]">
      <AccountMark id={row.accountId} />
      {row.accountName}
    </span>
    <Money
      cents={row.amount}
      sign
      className={cn(
        "text-right font-semibold",
        row.amount > 0 && !row.transferAccountId && "text-inflow"
      )}
    />
    <span
      title={row.cleared}
      className={cn(
        "size-2 justify-self-center rounded-full",
        row.cleared === "uncleared" && "ring-[1.5px] ring-gray-400 ring-inset"
      )}
    />
  </button>
);

const Field = ({
  label,
  icon,
  children,
  width,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
  width: number;
}) => (
  <label className="flex flex-col gap-1" style={{ width }}>
    <span className="text-text-tertiary text-xs font-medium">{label}</span>
    <span className="bg-surface-sunken flex h-[34px] items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium">
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {icon ? (
        <ChevronDown className="text-text-tertiary size-[13px]" aria-hidden />
      ) : null}
    </span>
  </label>
);

const Detail = ({ row }: { row: LedgerRow }) => (
  <div className="border-border-subtle mx-3 mt-0.5 flex items-end gap-4 border-t px-3 pt-3.5 pb-[18px]">
    <Field
      label="Category"
      width={240}
      icon={<CategoryIcon name={row.categoryIcon} className="size-3.5" />}
    >
      {row.categoryName ??
        (row.transferAccountId ? "Transfer" : "Choose a category")}
    </Field>
    <Field
      label="Account"
      width={180}
      icon={<Wallet className="text-text-tertiary size-3.5" />}
    >
      {row.accountName}
    </Field>
    <Field
      label="Date"
      width={170}
      icon={<CalendarDays className="text-text-tertiary size-3.5" />}
    >
      {new Date(`${row.date}T12:00:00Z`).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
        weekday: "short",
      })}
    </Field>
    <Field label="Memo" width={320}>
      {row.memo ?? <span className="text-text-tertiary">Add a memo</span>}
    </Field>
    <span className="border-border flex h-[34px] items-center gap-2 rounded-lg border px-3 text-[13px] font-medium">
      <span
        className={cn(
          "relative h-4 w-7 rounded-full",
          row.cleared === "uncleared" ? "bg-gray-300" : "bg-progress-funded"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-white",
            row.cleared === "uncleared" ? "left-0.5" : "left-[14px]"
          )}
        />
      </span>
      {row.cleared === "reconciled" ? "Reconciled" : "Cleared"}
    </span>
    <span className="flex-1" />
    <Button variant="ghost">
      <Split />
      Split
    </Button>
    <Button variant="ghost">
      <Trash2 />
      Delete
    </Button>
  </div>
);

/** Transactions grouped by day, newest first. A row opens its fields in place. */
export const Ledger = ({ rows }: { rows: readonly LedgerRow[] }) => {
  const [selected, setSelected] = useState<string | null>(null);
  const days = new Map<string, LedgerRow[]>();

  for (const row of rows.toSorted(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  )) {
    days.set(row.date, [...(days.get(row.date) ?? []), row]);
  }

  return (
    <section className="px-7 pb-10">
      <div
        className={cn(
          COLUMNS,
          "border-border-subtle text-text-tertiary sticky top-0 z-10 h-8 border-b bg-white px-3 text-xs font-medium"
        )}
      >
        <span>Payee</span>
        <span>Category</span>
        <span>Account</span>
        <span className="text-right">Amount</span>
        <span />
      </div>
      {days.size === 0 ? (
        <p className="text-text-tertiary px-3 py-10 text-center text-[13px] font-medium">
          No transactions match.
        </p>
      ) : null}
      {[...days].map(([date, entries]) => (
        <div key={date} className="mt-3">
          <h2 className="flex h-9 items-center justify-between px-3 text-[13px] font-semibold">
            <span className="flex items-baseline gap-2">
              {dayTitle(date)}
              <span className="text-text-tertiary font-medium">
                {entries.length}
              </span>
            </span>
            <Money
              cents={entries.reduce((sum, row) => sum + row.amount, 0)}
              sign
              className="text-text-tertiary pr-[52px] font-medium"
            />
          </h2>
          {entries.map((row) =>
            selected === row.id ? (
              <div
                key={row.id}
                className="shadow-card my-1 rounded-[14px] bg-white pt-0.5"
              >
                <Line row={row} selected onSelect={() => setSelected(null)} />
                <Detail row={row} />
              </div>
            ) : (
              <Line
                key={row.id}
                row={row}
                selected={false}
                onSelect={() => setSelected(row.id)}
              />
            )
          )}
        </div>
      ))}
    </section>
  );
};
