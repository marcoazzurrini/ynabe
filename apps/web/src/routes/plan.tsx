import { createFileRoute } from "@tanstack/react-router";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { inPlanFilter, planGroups, planView } from "@ynabe/views";
import type { PlanFilter, PlanRow } from "@ynabe/views";
import { Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { PhonePlan } from "../components/phone/plan";
import { usePhone } from "../components/phone/use-phone";
import type { AutoAssignOption } from "../components/plan/month-header";
import { MonthHeader } from "../components/plan/month-header";
import { PlanTable } from "../components/plan/table";
import { Segmented } from "../components/segmented";
import { setAssigned } from "../data/actions";
import { monthFromSearch, useBudget } from "../data/use-budget";

const PlanScreen = () => {
  const month = monthFromSearch(Route.useSearch());
  const { data, categories, groups } = useBudget();
  const [filter, setFilter] = useState<PlanFilter>("all");
  const phone = usePhone();

  const view = useMemo(
    () => planView({ ...data, categories, groups }, month),
    [data, categories, groups, month]
  );

  const { plan, rows } = view;
  const visible = planGroups(view, filter);

  const assignAll = (pick: (row: PlanRow) => number) => {
    for (const row of rows) {
      const amount = pick(row);

      if (amount !== row.assigned) {
        setAssigned(row.id, month, amount);
      }
    }
  };

  const fundUnderfunded = () =>
    assignAll((row) =>
      row.status === "underfunded" ? row.assigned + row.needed : row.assigned
    );

  const total = (pick: (row: PlanRow) => number) =>
    rows.reduce((sum, row) => sum + Math.max(0, pick(row) - row.assigned), 0);

  const options: AutoAssignOption[] = [
    {
      amount: plan.attention.needed,
      label: "Underfunded",
      run: fundUnderfunded,
    },
    {
      amount: total((row) => row.lastMonth),
      label: "Assigned last month",
      run: () => assignAll((row) => row.lastMonth),
    },
    {
      amount: total((row) =>
        Math.max(row.assigned, row.history.at(-1)?.spent ?? 0)
      ),
      label: "Spent last month",
      run: () =>
        assignAll((row) =>
          Math.max(row.assigned, row.history.at(-1)?.spent ?? 0)
        ),
    },
    {
      amount: total((row) => row.average),
      label: "Average assigned",
      run: () => assignAll((row) => row.average),
    },
  ];

  const attention = rows.filter((row) => inPlanFilter(row, "attention")).length;

  const under = rows.filter((row) => row.status === "underfunded").length;
  const over = rows.filter((row) => row.status === "overspent").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto max-md:pb-28">
      <MonthHeader month={month} plan={plan} options={options} />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-10 pb-2 max-md:px-4 max-md:pb-3">
        <Segmented
          label="Filter categories"
          value={filter}
          onChange={setFilter}
          options={[
            { count: rows.length, label: "All", value: "all" },
            {
              count: attention,
              label: "Needs attention",
              value: "attention",
            },
            {
              count: rows.filter((row) => inPlanFilter(row, "funded")).length,
              label: "Funded",
              value: "funded",
            },
          ]}
        />
        <p className="text-text-secondary flex items-center gap-2 text-[13px] font-medium">
          {under > 0 ? (
            <span className="flex items-center gap-2">
              <span className="bg-progress-under size-2 rounded-[2px]" />
              {under} need <Money cents={plan.attention.needed} />
            </span>
          ) : null}
          {under > 0 && over > 0 ? (
            <span className="text-text-disabled">·</span>
          ) : null}
          {over > 0 ? (
            <span className="flex items-center gap-2">
              <span className="bg-progress-over size-2 rounded-[2px]" />
              {over} overspent
            </span>
          ) : null}
          {under > 0 ? (
            <Button
              variant="link"
              className="ml-2 h-auto px-0 font-semibold text-(--blue-ink)"
              disabled={plan.readyToAssign < 0}
              onClick={fundUnderfunded}
            >
              <Zap />
              {plan.readyToAssign < 0
                ? "Fix over-assignment first"
                : "Fund them"}
            </Button>
          ) : null}
        </p>
      </div>
      {phone ? (
        <PhonePlan
          month={month}
          groups={visible}
          readyToAssign={plan.readyToAssign}
          onAssign={(categoryId, amount) =>
            setAssigned(categoryId, month, amount)
          }
        />
      ) : (
        <PlanTable
          month={month}
          groups={visible}
          onAssign={(categoryId, amount) =>
            setAssigned(categoryId, month, amount)
          }
        />
      )}
    </div>
  );
};

export const Route = createFileRoute("/plan")({ component: PlanScreen });
