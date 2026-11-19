import type { CategoryPlan } from "@ynabe/budget";
import { Envelope } from "@ynabe/ui/components/envelope";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { Sheet } from "@ynabe/ui/components/ui/sheet";
import { cn } from "@ynabe/ui/lib/utils";
import {
  groupSummary,
  planNote,
  targetReached,
  targetText,
} from "@ynabe/views";
import type { PlanGroup, PlanRow } from "@ynabe/views";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { monthShort } from "../../data/use-budget";
import { CategoryIcon } from "../category-icon";

const noteTone = { over: "text-over", under: "text-under" } as const;

const amountTone = (status: CategoryPlan["status"]) => {
  if (status === "overspent") {
    return "text-over";
  }

  return status === "underfunded" ? "text-under" : "text-text-primary";
};

const barTone = (status: CategoryPlan["status"]) => {
  if (status === "underfunded") {
    return "bg-progress-under";
  }

  return status === "overspent" ? "bg-progress-over" : "bg-progress-funded";
};

const Tile = ({ icon }: { icon: string | null | undefined }) => (
  <span className="bg-surface-sunken flex size-9 shrink-0 items-center justify-center rounded-[10px]">
    <CategoryIcon name={icon} className="text-text-secondary size-[18px]" />
  </span>
);

/** A group's categories as one bar: how many stand in each state. */
const Tally = ({ rows }: { rows: readonly PlanRow[] }) => {
  const summary = groupSummary(rows);

  const segments = [
    { color: "bg-progress-funded", count: summary.funded, id: "funded" },
    { color: "bg-progress-under", count: summary.underfunded, id: "under" },
    { color: "bg-progress-over", count: summary.overspent, id: "over" },
    { color: "bg-gray-300", count: summary.quiet, id: "quiet" },
  ].filter((segment) => segment.count > 0);

  return (
    <p className="text-text-secondary flex items-center gap-2.5 px-4 pb-3 text-xs font-medium">
      <span
        aria-hidden
        className="bg-progress-track flex h-1.5 w-24 shrink-0 gap-0.5 overflow-hidden rounded-full"
      >
        {segments.map((segment) => (
          <span
            key={segment.id}
            className={segment.color}
            style={{ flex: segment.count }}
          />
        ))}
      </span>
      <span className="truncate">{summary.text}</span>
    </p>
  );
};

const History = ({ row }: { row: PlanRow }) => {
  const peak = Math.max(
    1,
    ...row.history.flatMap((entry) => [entry.assigned, entry.spent])
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-tertiary flex items-center justify-between text-xs font-medium">
        <span className="text-text-secondary text-[13px] font-semibold">
          Last 6 months
        </span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-[#d6e0f7]" />
            Assigned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-[2px] bg-gray-500" />
            Spent
          </span>
        </span>
      </p>
      <div className="flex items-end justify-between px-1">
        {row.history.map((entry) => (
          <div key={entry.month} className="flex flex-col items-center gap-1.5">
            <div className="flex h-[72px] items-end gap-0.5">
              <span
                className="w-3.5 rounded-[3px] bg-[#d6e0f7]"
                style={{ height: `${(entry.assigned / peak) * 72}px` }}
              />
              <span
                className="w-3.5 rounded-[3px] bg-gray-500"
                style={{ height: `${(entry.spent / peak) * 72}px` }}
              />
            </div>
            <span className="text-text-tertiary text-[11px] font-medium">
              {monthShort(entry.month)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TargetCard = ({ row }: { row: PlanRow }) => {
  if (!row.target) {
    return (
      <p className="bg-surface-sunken text-text-secondary rounded-2xl px-4 py-3.5 text-sm font-medium">
        No target yet
      </p>
    );
  }

  return (
    <div className="bg-surface-sunken flex flex-col gap-2.5 rounded-2xl px-4 py-3.5">
      <p className="text-sm font-medium">
        <Money cents={row.target.amount} className="font-semibold" />{" "}
        <span className="text-text-secondary">{targetText(row.target)}</span>
      </p>
      <div className="bg-progress-track h-1.5 overflow-hidden rounded-full">
        <div
          className={cn(
            "h-1.5 origin-left rounded-full transition-transform duration-300 ease-out",
            barTone(row.status)
          )}
          style={{ transform: `scaleX(${Math.min(1, row.progress)})` }}
        />
      </div>
      <p className="text-text-tertiary flex justify-between text-xs font-medium">
        <span>
          <Money cents={targetReached(row)} /> of{" "}
          <Money cents={row.target.amount} />
        </span>
        <span>{Math.round(row.progress * 100)}%</span>
      </p>
    </div>
  );
};

const big = "h-12 rounded-[14px] text-[15px] font-semibold";

interface CategorySheetProps {
  open: boolean;
  /** The category shown. It stays while the sheet slides away. */
  row: PlanRow | null;
  group: string;
  month: string;
  readyToAssign: number;
  onAssign: (amount: number) => void;
  onClose: () => void;
}

/** One category on a phone: what it holds, its target, and ways to fund it. */
const CategorySheet = ({
  open,
  row,
  group,
  month,
  readyToAssign,
  onAssign,
  onClose,
}: CategorySheetProps) => (
  <Sheet
    open={open}
    onClose={onClose}
    title={row?.name}
    caption={group}
    lead={<Tile icon={row?.icon} />}
  >
    {row ? (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col">
          <Money
            cents={row.available}
            className={cn(
              "text-[40px] leading-[46px] font-semibold tracking-tight",
              amountTone(row.status)
            )}
          />
          <span className="text-text-secondary text-[13px] font-medium">
            {planNote(row, month)?.text ?? "Available"}
          </span>
        </div>
        <TargetCard row={row} />
        <div className="flex flex-col gap-2">
          <span className="text-text-secondary text-[13px] font-semibold">
            Assign
          </span>
          {row.needed > 0 ? (
            <Button
              className={big}
              onClick={() => onAssign(row.assigned + row.needed)}
            >
              <Check />
              Finish target · <Money cents={row.needed} />
            </Button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className={cn(big, "font-medium")}
              disabled={row.lastMonth === row.assigned}
              onClick={() => onAssign(row.lastMonth)}
            >
              Last month · <Money cents={row.lastMonth} />
            </Button>
            <Button
              variant="outline"
              className={cn(big, "font-medium")}
              disabled={row.average === row.assigned}
              onClick={() => onAssign(row.average)}
            >
              Average · <Money cents={row.average} />
            </Button>
          </div>
          <p className="text-text-tertiary text-xs font-medium">
            <Money cents={row.assigned} /> assigned this month. It comes from
            Ready to Assign (<Money cents={readyToAssign} />
            ).
          </p>
        </div>
        <History row={row} />
      </div>
    ) : null}
  </Sheet>
);

interface PhonePlanProps {
  month: string;
  groups: readonly PlanGroup[];
  readyToAssign: number;
  onAssign: (categoryId: string, amount: number) => void;
}

/** The plan on a phone: a card per group, and a sheet for a category. */
export const PhonePlan = ({
  month,
  groups,
  readyToAssign,
  onAssign,
}: PhonePlanProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const group = groups.find((entry) =>
    entry.rows.some((row) => row.id === selected)
  );

  const row = group?.rows.find((entry) => entry.id === selected) ?? null;

  return (
    <section className="flex flex-col gap-3 px-4">
      {groups.length === 0 ? (
        <p className="text-text-tertiary py-10 text-center text-[13px] font-medium">
          No categories match this filter.
        </p>
      ) : null}
      {groups.map((entry) => {
        const closed = collapsed.includes(entry.id);

        return (
          <div
            key={entry.id}
            className="shadow-card overflow-hidden rounded-2xl bg-white"
          >
            <button
              type="button"
              aria-expanded={!closed}
              onClick={() =>
                setCollapsed((current) =>
                  closed
                    ? current.filter((id) => id !== entry.id)
                    : [...current, entry.id]
                )
              }
              className="flex h-12 w-full items-center gap-2 px-4 text-left text-[15px] font-semibold"
            >
              {closed ? (
                <ChevronRight
                  className="text-text-secondary size-4"
                  aria-hidden
                />
              ) : (
                <ChevronDown
                  className="text-text-secondary size-4"
                  aria-hidden
                />
              )}
              <span className="truncate">{entry.name}</span>
              <span className="bg-surface-sunken text-text-tertiary tabular rounded-full px-[7px] py-px text-xs">
                {entry.rows.length}
              </span>
              <Money
                cents={entry.rows.reduce(
                  (sum, item) => sum + item.available,
                  0
                )}
                className="ml-auto"
              />
            </button>
            <Tally rows={entry.rows} />
            {closed
              ? null
              : entry.rows.map((item) => {
                  const note = planNote(item, month);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelected(item.id);
                        setOpen(true);
                      }}
                      className="border-border-subtle active:bg-surface-app flex h-[58px] w-full items-center gap-3 border-t px-4 text-left"
                    >
                      <Tile icon={item.icon} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] leading-5 font-medium">
                          {item.name}
                        </span>
                        {note ? (
                          <span
                            className={cn(
                              "truncate text-xs font-medium",
                              noteTone[note.tone]
                            )}
                          >
                            {note.text}
                          </span>
                        ) : null}
                      </span>
                      <Envelope
                        cents={item.available}
                        progress={item.progress}
                        state={item.status}
                        className="w-[104px] shrink-0"
                      />
                    </button>
                  );
                })}
          </div>
        );
      })}
      <CategorySheet
        open={open}
        row={row}
        group={group?.name ?? ""}
        month={month}
        readyToAssign={readyToAssign}
        onAssign={(amount) => {
          if (row) {
            onAssign(row.id, amount);
          }
        }}
        onClose={() => setOpen(false)}
      />
    </section>
  );
};
