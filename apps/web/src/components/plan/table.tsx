import type { CategoryPlan, Target } from "@ynabe/budget";
import { Envelope } from "@ynabe/ui/components/envelope";
import type { EnvelopeState } from "@ynabe/ui/components/envelope";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import {
  ArrowRightLeft,
  BellOff,
  Check,
  ChevronDown,
  ChevronRight,
  History,
  Sigma,
  Target as TargetIcon,
} from "lucide-react";
import { useState } from "react";

import { monthShort } from "../../data/use-budget";
import { CategoryIcon } from "../category-icon";

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_340px_140px_140px_200px] items-center gap-x-6";

const envelopeState: Record<CategoryPlan["status"], EnvelopeState> = {
  available: "available",
  empty: "empty",
  funded: "funded",
  overspent: "overspent",
  underfunded: "underfunded",
};

export interface PlanRow extends CategoryPlan {
  icon: string | null;
  target?: Target;
  lastMonth: number;
  average: number;
  /** Oldest first: what was assigned and spent in each of the last 6 months. */
  history: { month: string; assigned: number; spent: number }[];
}

export interface PlanGroup {
  id: string;
  name: string;
  rows: PlanRow[];
}

const Quiet = ({ cents }: { cents: number }) =>
  cents === 0 ? (
    <span className="text-gray-350 text-right">—</span>
  ) : (
    <Money cents={cents} className="text-text-secondary text-right" />
  );

const Note = ({ row, month }: { row: PlanRow; month: string }) => {
  if (row.status === "overspent") {
    return (
      <span className="text-over text-[13px]">
        Overspent by <Money cents={-row.available} />
      </span>
    );
  }

  if (row.status === "underfunded") {
    const lastDay = new Date(
      Number(month.slice(0, 4)),
      Number(month.slice(5, 7)),
      0
    ).getDate();

    const due =
      row.target?.kind === "monthly"
        ? ` by ${monthShort(month)} ${row.target.dueDay ?? lastDay}`
        : " this month";

    return (
      <span className="text-under text-[13px]">
        Needs <Money cents={row.needed} />
        {due}
      </span>
    );
  }

  return <span />;
};

const targetText = (target: Target | undefined) => {
  if (!target) {
    return null;
  }

  if (target.kind === "monthly") {
    return target.dueDay
      ? `every month, by the ${target.dueDay}th`
      : "every month";
  }

  return target.by
    ? `saved by ${new Date(`${target.by}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC", year: "numeric" })}`
    : "saved";
};

const progressTone = (status: CategoryPlan["status"]) => {
  if (status === "underfunded") {
    return "bg-progress-under";
  }

  return status === "overspent" ? "bg-progress-over" : "bg-progress-funded";
};

const Detail = ({
  row,
  onAssign,
}: {
  row: PlanRow;
  onAssign: (amount: number) => void;
}) => {
  const peak = Math.max(
    1,
    ...row.history.flatMap((entry) => [entry.assigned, entry.spent])
  );

  const goal = row.target?.amount ?? 0;

  const reached =
    row.target?.kind === "monthly" ? row.assigned : Math.max(0, row.available);

  return (
    <div className="border-border-subtle mx-3 mt-0.5 flex gap-14 border-t pt-3 pr-6 pb-[22px] pl-[27px]">
      <div className="flex w-[360px] shrink-0 flex-col gap-3">
        <span className="text-text-tertiary text-xs font-medium">Target</span>
        {row.target ? (
          <>
            <p className="text-sm font-medium">
              <Money cents={goal} className="font-semibold" />{" "}
              <span className="text-text-secondary">
                {targetText(row.target)}
              </span>
            </p>
            <div className="bg-progress-track h-1.5 rounded-full">
              <div
                className={cn("h-1.5 rounded-full", progressTone(row.status))}
                style={{ width: `${row.progress * 100}%` }}
              />
            </div>
            <p className="text-text-tertiary flex justify-between text-xs font-medium">
              <span>
                <Money cents={reached} /> of <Money cents={goal} />
              </span>
              <span>{Math.round(row.progress * 100)}%</span>
            </p>
          </>
        ) : (
          <p className="text-text-secondary text-sm font-medium">
            No target yet
          </p>
        )}
        <div className="flex gap-1">
          <Button variant="ghost" className="pl-0">
            <TargetIcon />
            {row.target ? "Edit target" : "Add a target"}
          </Button>
          <Button variant="ghost">
            <BellOff />
            Snooze
          </Button>
        </div>
      </div>
      <div className="flex w-[470px] shrink-0 flex-col gap-3">
        <span className="text-text-tertiary text-xs font-medium">Assign</span>
        <div className="flex flex-wrap gap-2">
          {row.needed > 0 ? (
            <Button onClick={() => onAssign(row.assigned + row.needed)}>
              <Check />
              Finish target · <Money cents={row.needed} />
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => onAssign(row.lastMonth)}
            disabled={row.lastMonth === row.assigned}
          >
            <History />
            Last month · <Money cents={row.lastMonth} />
          </Button>
          <Button
            variant="outline"
            onClick={() => onAssign(row.average)}
            disabled={row.average === row.assigned}
          >
            <Sigma />
            Average · <Money cents={row.average} />
          </Button>
          <Button variant="ghost">
            <ArrowRightLeft />
            Move money…
          </Button>
        </div>
        <p className="text-text-tertiary text-xs font-medium">
          Assigning comes from Ready to Assign.
        </p>
      </div>
      <div className="flex w-[320px] shrink-0 flex-col gap-3">
        <span className="text-text-tertiary text-xs font-medium">
          Last 6 months
        </span>
        <div className="flex h-[84px] items-end gap-[18px]">
          {row.history.map((entry) => (
            <div
              key={entry.month}
              className="flex flex-col items-center gap-1.5"
            >
              <div className="flex h-[72px] items-end gap-0.5">
                <span
                  className="w-3.5 rounded-[3px] bg-[#d6e0f7]"
                  style={{ height: `${(entry.assigned / peak) * 72}px` }}
                  title={`Assigned ${entry.assigned / 100}€`}
                />
                <span
                  className="w-3.5 rounded-[3px] bg-gray-500"
                  style={{ height: `${(entry.spent / peak) * 72}px` }}
                  title={`Spent ${entry.spent / 100}€`}
                />
              </div>
              <span className="text-text-tertiary text-[11px]">
                {monthShort(entry.month)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-text-tertiary flex gap-4 text-xs font-medium">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-[2px] bg-[#d6e0f7]" />
            Assigned
          </span>
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-[2px] bg-gray-500" />
            Spent
          </span>
        </p>
      </div>
    </div>
  );
};

const Row = ({
  row,
  month,
  selected,
  onSelect,
  onAssign,
}: {
  row: PlanRow;
  month: string;
  selected: boolean;
  onSelect: () => void;
  onAssign: (amount: number) => void;
}) => {
  const line = (
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
      <span className="flex min-w-0 items-center gap-3">
        <CategoryIcon name={row.icon} />
        <span className="truncate">{row.name}</span>
      </span>
      <Note row={row} month={month} />
      <Quiet cents={row.assigned} />
      <Quiet cents={-row.activity} />
      <span className="flex justify-end">
        <Envelope
          cents={row.available}
          progress={row.progress}
          state={envelopeState[row.status]}
        />
      </span>
    </button>
  );

  if (!selected) {
    return line;
  }

  return (
    <div className="shadow-card my-1 rounded-[14px] bg-white pt-0.5">
      {line}
      <Detail row={row} onAssign={onAssign} />
    </div>
  );
};

interface PlanTableProps {
  month: string;
  groups: readonly PlanGroup[];
  onAssign: (categoryId: string, amount: number) => void;
}

/** Category groups and their envelopes; a row opens its detail in place. */
export const PlanTable = ({ month, groups, onAssign }: PlanTableProps) => {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<string[]>([]);

  return (
    <section className="px-7 pb-10">
      <div
        className={cn(
          COLUMNS,
          "border-border-subtle text-text-tertiary sticky top-0 z-10 h-8 border-b bg-white px-3 text-xs font-medium"
        )}
      >
        <span>Category</span>
        <span />
        <span className="text-right">Assigned</span>
        <span className="text-right">Spent</span>
        <span className="pr-2.5 text-right">Available</span>
      </div>
      {groups.length === 0 ? (
        <p className="text-text-tertiary px-3 py-10 text-center text-[13px] font-medium">
          No categories match this filter.
        </p>
      ) : null}
      {groups.map((group) => {
        const closed = collapsed.includes(group.id);

        return (
          <div key={group.id} className="mt-3">
            <button
              type="button"
              aria-expanded={!closed}
              onClick={() =>
                setCollapsed((current) =>
                  closed
                    ? current.filter((id) => id !== group.id)
                    : [...current, group.id]
                )
              }
              className={cn(
                COLUMNS,
                "h-10 w-full px-3 text-left text-[13px] font-semibold"
              )}
            >
              <span className="flex items-center gap-2">
                {closed ? (
                  <ChevronRight
                    className="text-text-tertiary size-3.5"
                    aria-hidden
                  />
                ) : (
                  <ChevronDown
                    className="text-text-tertiary size-3.5"
                    aria-hidden
                  />
                )}
                {group.name}
                <span className="text-text-tertiary font-medium">
                  {group.rows.length}
                </span>
              </span>
              <span />
              <Money
                cents={group.rows.reduce((sum, row) => sum + row.assigned, 0)}
                className="text-text-tertiary text-right font-medium"
              />
              <Money
                cents={-group.rows.reduce((sum, row) => sum + row.activity, 0)}
                className="text-text-tertiary text-right font-medium"
              />
              <Money
                cents={group.rows.reduce((sum, row) => sum + row.available, 0)}
                className="text-text-secondary pr-2.5 text-right"
              />
            </button>
            {closed
              ? null
              : group.rows.map((row) => (
                  <Row
                    key={row.id}
                    row={row}
                    month={month}
                    selected={selected === row.id}
                    onSelect={() =>
                      setSelected((current) =>
                        current === row.id ? null : row.id
                      )
                    }
                    onAssign={(amount) => onAssign(row.id, amount)}
                  />
                ))}
          </div>
        );
      })}
    </section>
  );
};
