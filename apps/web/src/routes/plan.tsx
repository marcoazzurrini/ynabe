import { createFileRoute } from "@tanstack/react-router";
import { addMonths, planMonth } from "@ynabe/budget";
import { Button } from "@ynabe/ui/components/ui/button";
import { LayoutGrid, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import type { AutoAssignOption } from "../components/plan/month-header";
import { MonthHeader } from "../components/plan/month-header";
import type { PlanGroup, PlanRow } from "../components/plan/table";
import { PlanTable } from "../components/plan/table";
import { Segmented } from "../components/segmented";
import { Topbar } from "../components/topbar";
import { setAssigned } from "../data/actions";
import {
  monthFromSearch,
  monthName,
  monthYear,
  useBudget,
} from "../data/use-budget";

type Filter = "all" | "attention" | "funded" | "snoozed";

const matches = (row: PlanRow, filter: Filter) => {
  if (filter === "attention") {
    return row.status === "underfunded" || row.status === "overspent";
  }

  if (filter === "funded") {
    return row.status === "funded" || row.status === "available";
  }

  return filter === "all";
};

const PlanScreen = () => {
  const month = monthFromSearch(Route.useSearch());
  const { data, categories, groups } = useBudget();
  const [filter, setFilter] = useState<Filter>("all");

  const plans = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        planMonth(data, addMonths(month, index - 6))
      ),
    [data, month]
  );

  const plan = plans.at(-1) ?? planMonth(data, month);
  const previous = plans.at(-2);

  const rows = useMemo(
    () =>
      plan.categories.map((category): PlanRow => {
        const source = categories.find((entry) => entry.id === category.id);

        const past = plans
          .slice(3, 6)
          .map(
            (entry) =>
              entry.categories.find(({ id }) => id === category.id)?.assigned ??
              0
          );

        return {
          ...category,
          average: Math.round(
            past.reduce((sum, value) => sum + value, 0) /
              Math.max(1, past.length)
          ),
          history: plans.slice(1).map((entry) => {
            const found = entry.categories.find(({ id }) => id === category.id);

            return {
              assigned: found?.assigned ?? 0,
              month: entry.month,
              spent: Math.max(0, -(found?.activity ?? 0)),
            };
          }),
          icon: source?.icon ?? null,
          lastMonth:
            previous?.categories.find(({ id }) => id === category.id)
              ?.assigned ?? 0,
          target: source?.target,
        };
      }),
    [plan, plans, previous, categories]
  );

  const visible: PlanGroup[] = groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      rows: rows.filter(
        (row) => row.groupId === group.id && matches(row, filter)
      ),
    }))
    .filter((group) => group.rows.length > 0);

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

  const attention = rows.filter((row) => matches(row, "attention")).length;

  return (
    <>
      <Topbar
        icon={LayoutGrid}
        title="Plan"
        context={`${monthName(month)} ${monthYear(month)}`}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MonthHeader
          month={month}
          plan={plan}
          options={options}
          onFundAll={fundUnderfunded}
        />
        <div className="flex items-center justify-between px-10 pb-2">
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
                count: rows.filter((row) => matches(row, "funded")).length,
                label: "Funded",
                value: "funded",
              },
              { count: 0, label: "Snoozed", value: "snoozed" },
            ]}
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost">
              <Plus />
              Group
            </Button>
            <Button variant="ghost">
              <SlidersHorizontal />
              View
            </Button>
            <Button variant="ghost" size="icon" aria-label="Search categories">
              <Search />
            </Button>
          </div>
        </div>
        <PlanTable
          month={month}
          groups={visible}
          onAssign={(categoryId, amount) =>
            setAssigned(categoryId, month, amount)
          }
        />
      </div>
    </>
  );
};

export const Route = createFileRoute("/plan")({ component: PlanScreen });
