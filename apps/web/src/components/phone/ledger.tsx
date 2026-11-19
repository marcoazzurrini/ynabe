import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { Sheet } from "@ynabe/ui/components/ui/sheet";
import { cn } from "@ynabe/ui/lib/utils";
import { ledgerDays } from "@ynabe/views";
import type { LedgerDay } from "@ynabe/views";
import { Check, Tag } from "lucide-react";
import { useState } from "react";

import { AccountMark } from "../account-mark";
import {
  Category,
  ClearedMark,
  dayTitle,
  isToday,
  totalTone,
} from "../accounts/ledger";
import type { LedgerRow } from "../accounts/ledger";
import { CategoryIcon } from "../category-icon";

/** Rows shown at first, and added by each "Show older". */
const PAGE = 150;

/** An inflow can go straight to Ready to Assign. */
const READY_TO_ASSIGN = "ready-to-assign";

export interface CategoryChoice {
  id: string;
  name: string;
  icon: string | null;
}

export interface CategoryChoices {
  id: string;
  name: string;
  categories: readonly CategoryChoice[];
}

const Day = ({
  day,
  onSelect,
}: {
  day: LedgerDay<LedgerRow>;
  onSelect: (id: string) => void;
}) => {
  const today = isToday(day.date);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2.5 px-1 text-sm font-semibold">
        <span
          aria-hidden
          className={cn(
            "tabular flex size-7 items-center justify-center rounded-md text-[13px] font-bold",
            today ? "bg-(--blue) text-white" : "bg-white shadow-xs"
          )}
        >
          {Number(day.date.slice(8))}
        </span>
        <span className="truncate">{dayTitle(day.date)}</span>
        {today ? (
          <span className="rounded-full bg-(--blue-tint) px-[7px] py-px text-[11px] text-(--blue-ink)">
            Today
          </span>
        ) : null}
        <Money
          cents={day.total}
          sign
          className={cn("ml-auto text-[13px]", totalTone(day.total))}
        />
      </h2>
      <div className="shadow-card overflow-hidden rounded-2xl bg-white">
        {day.rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            className="border-border-subtle active:bg-surface-app flex h-[62px] w-full items-center gap-3 px-3.5 text-left not-first:border-t"
          >
            <AccountMark
              id={row.accountId}
              name={row.accountName}
              className="size-9 rounded-[10px] text-base"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] leading-5 font-medium">
                {row.payee}
              </span>
              <Category row={row} />
            </span>
            <Money
              cents={row.amount}
              sign
              className={cn(
                "text-[15px] font-semibold",
                row.amount > 0 && !row.transferAccountId && "text-inflow"
              )}
            />
            <ClearedMark cleared={row.cleared} />
          </button>
        ))}
      </div>
    </div>
  );
};

const choice =
  "active:bg-surface-app flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-[15px] font-medium";

interface TransactionSheetProps {
  open: boolean;
  /** The transaction shown. It stays while the sheet slides away. */
  row: LedgerRow | null;
  choices: readonly CategoryChoices[];
  onCategorize: (categoryId: string) => void;
  onClose: () => void;
}

/** One transaction on a phone, and the category it is filed under. */
const TransactionSheet = ({
  open,
  row,
  choices,
  onCategorize,
  onClose,
}: TransactionSheetProps) => (
  <Sheet
    open={open}
    onClose={onClose}
    title={row?.payee}
    caption={row ? `${row.accountName} · ${dayTitle(row.date)}` : undefined}
    lead={
      row ? (
        <AccountMark
          id={row.accountId}
          name={row.accountName}
          className="size-9 rounded-[10px] text-base"
        />
      ) : null
    }
  >
    {row ? (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          <Money
            cents={row.amount}
            sign
            className={cn(
              "text-[40px] leading-[46px] font-semibold tracking-tight",
              row.amount > 0 && !row.transferAccountId && "text-inflow"
            )}
          />
          {row.memo ? (
            <span className="text-text-secondary text-[13px] font-medium">
              {row.memo}
            </span>
          ) : null}
        </div>
        {row.transferAccountId ? (
          <p className="bg-surface-sunken text-text-secondary rounded-2xl px-4 py-3.5 text-sm font-medium">
            A transfer with {row.transferName}. Transfers have no category.
          </p>
        ) : (
          <>
            {row.categoryId === null && row.guessId ? (
              <Button
                className="h-12 rounded-[14px] text-[15px] font-semibold"
                onClick={() => onCategorize(row.guessId ?? "")}
              >
                <Tag />
                File under {row.guess}
              </Button>
            ) : null}
            {row.amount > 0 ? (
              <button
                type="button"
                className={choice}
                onClick={() => onCategorize(READY_TO_ASSIGN)}
              >
                <span className="flex-1">Ready to Assign</span>
                {row.categoryId === READY_TO_ASSIGN ? (
                  <Check className="size-4 text-(--blue)" aria-label="Chosen" />
                ) : null}
              </button>
            ) : null}
            {choices.map((group) => (
              <div key={group.id} className="flex flex-col">
                <h3 className="text-text-tertiary px-2 pb-1 text-xs font-semibold">
                  {group.name}
                </h3>
                {group.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={choice}
                    onClick={() => onCategorize(category.id)}
                  >
                    <CategoryIcon
                      name={category.icon}
                      className="size-[18px]"
                    />
                    <span className="flex-1 truncate">{category.name}</span>
                    {row.categoryId === category.id ? (
                      <Check
                        className="size-4 text-(--blue)"
                        aria-label="Chosen"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    ) : null}
  </Sheet>
);

interface PhoneLedgerProps {
  rows: readonly LedgerRow[];
  choices: readonly CategoryChoices[];
  onCategorize: (transactionId: string, categoryId: string) => void;
}

/** Transactions on a phone: a card per day, and a sheet to file one. */
export const PhoneLedger = ({
  rows,
  choices,
  onCategorize,
}: PhoneLedgerProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const newest = rows
    .toSorted(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    )
    .slice(0, limit);

  const row = rows.find((entry) => entry.id === selected) ?? null;

  return (
    <section className="flex flex-col gap-4 px-4">
      {rows.length === 0 ? (
        <p className="text-text-tertiary py-10 text-center text-[13px] font-medium">
          No transactions match.
        </p>
      ) : null}
      {ledgerDays(newest).map((day) => (
        <Day
          key={day.date}
          day={day}
          onSelect={(id) => {
            setSelected(id);
            setOpen(true);
          }}
        />
      ))}
      {rows.length > limit ? (
        <Button
          variant="outline"
          className="h-11 rounded-[14px] text-sm"
          onClick={() => setLimit((current) => current + PAGE)}
        >
          Show older
        </Button>
      ) : null}
      <TransactionSheet
        open={open}
        row={row}
        choices={choices}
        onCategorize={(categoryId) => {
          if (row) {
            onCategorize(row.id, categoryId);
          }

          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </section>
  );
};
