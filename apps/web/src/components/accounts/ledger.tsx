import type { LedgerTransaction } from "@ynabe/db";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import type { LedgerRow as Row } from "@ynabe/views";
import {
  ArrowLeftRight,
  ArrowDownLeft,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDashed,
  Lock,
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
  "grid grid-cols-[minmax(0,1fr)_300px_150px_20px] items-center gap-x-6";

export type LedgerRow = Row<LedgerTransaction>;

export const dayTitle = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    weekday: "long",
  });

export const isToday = (date: string) =>
  date === new Date().toISOString().slice(0, 10);

export const totalTone = (cents: number) => {
  if (cents < 0) {
    return "text-over";
  }

  return cents > 0 ? "text-inflow" : "text-text-secondary";
};

export const ClearedMark = ({ cleared }: { cleared: LedgerRow["cleared"] }) => {
  if (cleared === "uncleared") {
    return (
      <CircleDashed
        className="text-text-secondary size-3.5 justify-self-center"
        aria-label="Uncleared"
      />
    );
  }

  return cleared === "reconciled" ? (
    <Lock
      className="size-3.5 justify-self-center text-gray-400"
      aria-label="Reconciled"
    />
  ) : (
    <Check
      className="text-gray-350 size-3.5 justify-self-center"
      aria-label="Cleared"
    />
  );
};

/** The tinted band that opens a day: its date, how many rows, and the net. */
const DayBand = ({
  date,
  entries,
}: {
  date: string;
  entries: readonly LedgerRow[];
}) => {
  const today = isToday(date);

  return (
    <h2 className="bg-surface-sunken mb-1 flex h-9 items-center justify-between rounded-lg pr-3 pl-1.5 text-[13px] font-semibold">
      <span className="flex items-center gap-3">
        <span
          className={cn(
            "tabular flex size-7 items-center justify-center rounded-md font-bold",
            today ? "bg-(--blue) text-white" : "bg-white shadow-xs"
          )}
          aria-hidden
        >
          {Number(date.slice(8))}
        </span>
        <span className="flex items-baseline gap-2">
          {dayTitle(date)}
          <span className="text-text-tertiary text-xs font-medium">
            {entries.length}{" "}
            {entries.length === 1 ? "transaction" : "transactions"}
          </span>
        </span>
        {today ? (
          <span className="rounded-full bg-(--blue-tint) px-[7px] py-px text-[11px] text-(--blue-ink)">
            Today
          </span>
        ) : null}
      </span>
      <Money
        cents={entries.reduce((sum, row) => sum + row.amount, 0)}
        sign
        className={cn(
          "pr-11",
          totalTone(entries.reduce((sum, row) => sum + row.amount, 0))
        )}
      />
    </h2>
  );
};

export const Category = ({ row }: { row: LedgerRow }) => {
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
      "focus-visible:outline-ring h-11 w-full cursor-pointer rounded-[10px] px-3 text-left text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2",
      !selected && "hover:bg-surface-app"
    )}
  >
    <span className="flex min-w-0 items-baseline gap-2">
      <AccountMark
        id={row.accountId}
        name={row.accountName}
        className="mr-1 self-center"
      />
      <span className="whitespace-nowrap">{row.payee}</span>
      {row.memo ? (
        <span className="text-text-tertiary truncate text-[13px]">
          {row.memo}
        </span>
      ) : null}
    </span>
    <Category row={row} />
    <Money
      cents={row.amount}
      sign
      className={cn(
        "text-right font-semibold",
        row.amount > 0 && !row.transferAccountId && "text-inflow"
      )}
    />
    <ClearedMark cleared={row.cleared} />
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
          <DayBand date={date} entries={entries} />
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
