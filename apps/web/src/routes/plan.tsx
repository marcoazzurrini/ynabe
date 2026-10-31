import { createFileRoute } from "@tanstack/react-router";
import { planMonth } from "@ynabe/budget";
import type { CategoryPlan } from "@ynabe/budget";
import { Envelope } from "@ynabe/ui/components/envelope";
import type { EnvelopeState } from "@ynabe/ui/components/envelope";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { Zap } from "lucide-react";
import { useMemo } from "react";

import { assignments } from "../data/collections";
import {
  currentMonth,
  groupTitle,
  monthTitle,
  useBudget,
} from "../data/use-budget";

const envelopeState: Record<CategoryPlan["status"], EnvelopeState> = {
  available: "available",
  empty: "empty",
  funded: "funded",
  overspent: "overspent",
  underfunded: "underfunded",
};

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_340px_140px_140px_200px] items-center gap-x-6";

/** Assigns what a category still needs, on top of what it already has. */
const fund = (category: CategoryPlan, month: string) => {
  const key: `${string}:${string}` = `${category.id}:${month}`;
  const amount = category.assigned + category.needed;

  if (assignments.has(key)) {
    assignments.update(key, (draft) => {
      draft.amount = amount;
    });
  } else {
    assignments.insert({ amount, categoryId: category.id, month });
  }
};

const Note = ({ category }: { category: CategoryPlan }) => {
  if (category.status === "overspent") {
    return (
      <span className="text-over text-[13px]">
        Overspent by <Money cents={-category.available} />
      </span>
    );
  }

  if (category.status === "underfunded") {
    return (
      <span className="text-under text-[13px]">
        Needs <Money cents={category.needed} />
      </span>
    );
  }

  return <span />;
};

const Quiet = ({ cents }: { cents: number }) =>
  cents === 0 ? (
    <span className="text-gray-350 text-right">—</span>
  ) : (
    <Money cents={Math.abs(cents)} className="text-text-secondary text-right" />
  );

const PlanScreen = () => {
  const month = currentMonth();
  const { data, ready } = useBudget();
  const plan = useMemo(() => planMonth(data, month), [data, month]);
  const groups = new Map<string, CategoryPlan[]>();

  for (const category of plan.categories) {
    groups.set(category.groupId, [
      ...(groups.get(category.groupId) ?? []),
      category,
    ]);
  }

  const underfunded = plan.categories.filter(
    ({ status }) => status === "underfunded"
  );

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-6 px-10 pt-9 pb-7">
        <h1 className="text-[40px] leading-[44px] font-semibold tracking-tight">
          {monthTitle(month)}
        </h1>
        <div className="flex items-stretch gap-5">
          <div className="border-funded-border bg-funded-bg flex items-center gap-6 rounded-[14px] border py-3 pr-3 pl-5">
            <div className="flex flex-col">
              <Money
                cents={plan.readyToAssign}
                className="text-funded text-[28px] leading-8 font-semibold tracking-tight"
              />
              <span className="text-funded text-xs font-medium">
                Ready to assign
              </span>
            </div>
          </div>
          <div className="shadow-card flex max-w-[640px] flex-1 flex-col gap-3 rounded-[14px] bg-white px-5 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <p>
                <span className="text-[22px] font-semibold tracking-tight">
                  {Math.round(plan.funded * 100)}%
                </span>
                <span className="text-text-tertiary text-[13px] font-medium">
                  {" "}
                  of {monthTitle(month).split(" ")[0]}’s targets funded
                </span>
              </p>
              <Button
                variant="outline"
                disabled={underfunded.length === 0 || !ready}
                onClick={() => {
                  for (const category of underfunded) {
                    fund(category, month);
                  }
                }}
              >
                <Zap />
                Fund {underfunded.length} ·{" "}
                <Money cents={plan.attention.needed} />
              </Button>
            </div>
            <div className="bg-progress-track h-1.5 rounded-full">
              <div
                className="bg-progress-funded h-1.5 rounded-full"
                style={{ width: `${plan.funded * 100}%` }}
              />
            </div>
          </div>
        </div>
      </section>
      <section className="px-7">
        <div
          className={`${COLUMNS} border-border-subtle text-text-tertiary h-8 border-b px-3 text-xs font-medium`}
        >
          <span>Category</span>
          <span />
          <span className="text-right">Assigned</span>
          <span className="text-right">Spent</span>
          <span className="pr-2.5 text-right">Available</span>
        </div>
        {[...groups].map(([groupId, rows]) => (
          <div key={groupId} className="mt-3">
            <h2 className="flex h-10 items-center gap-2 px-3 text-[13px] font-semibold">
              {groupTitle(groupId)}
              <span className="text-text-tertiary font-medium">
                {rows.length}
              </span>
            </h2>
            {rows.map((category) => (
              <div
                key={category.id}
                className={`${COLUMNS} hover:bg-surface-app h-11 rounded-[10px] px-3 text-sm font-medium`}
              >
                <span className="truncate">{category.name}</span>
                <Note category={category} />
                <Quiet cents={category.assigned} />
                <Quiet cents={category.activity} />
                <div className="flex justify-end">
                  <Envelope
                    cents={category.available}
                    progress={category.progress}
                    state={envelopeState[category.status]}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
};

export const Route = createFileRoute("/plan")({ component: PlanScreen });
