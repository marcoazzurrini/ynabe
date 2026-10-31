import { createFileRoute, Link } from "@tanstack/react-router";
import { READY_TO_ASSIGN } from "@ynabe/budget";
import { spendingReport } from "@ynabe/reports";
import type { SpendingReport } from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import {
  CalendarDays,
  ChartLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { PaceChart } from "../components/reflect/pace-chart";
import {
  Card,
  GroupRanges,
  Heatmap,
  Key,
  KpiStrip,
  percent,
} from "../components/reflect/parts";
import { Segmented } from "../components/segmented";
import {
  monthFromSearch,
  monthName,
  monthYear,
  nextMonth,
  previousMonth,
  useBudget,
} from "../data/use-budget";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

const TABS = [
  "Spending",
  "Trends",
  "Net worth",
  "Income vs expense",
  "Age of money",
];

interface Figures {
  name: string;
  previousName: string;
  report: SpendingReport;
  previousIncome: number;
  typicalDaily: number;
}

const headlineFor = ({ name, previousName, report }: Figures): ReactNode => {
  if (report.spent === 0) {
    return (
      <>
        Nothing to reflect on yet.{" "}
        <span className="text-text-tertiary">
          Add or import {name}’s transactions to see where your money goes.
        </span>
      </>
    );
  }

  const exception = report.groups.find(
    (group) => group.unusual?.direction === "above"
  );

  const opening =
    report.change === null
      ? `${name} is your first month with spending.`
      : `${name} was ${percent.format(Math.abs(report.change))} ${report.change < 0 ? "lighter" : "heavier"} than ${previousName}.`;

  return (
    <>
      {opening}{" "}
      <span className="text-text-tertiary">
        {exception
          ? `${exception.name} is the exception.`
          : "Every group stayed within its usual range."}
      </span>
    </>
  );
};

const kpisFor = ({
  previousName,
  report,
  previousIncome,
  typicalDaily,
}: Figures) => {
  const empty = report.spent === 0;
  const kept = report.income - report.spent;
  const noIncome = report.income === 0;
  const sameIncome = report.income === previousIncome;

  const incomeChange =
    previousIncome === 0 ? 1 : report.income / previousIncome - 1;

  return [
    {
      delta:
        report.change === null
          ? "No earlier month"
          : `${percent.format(Math.abs(report.change))} vs ${previousName}`,
      good: report.change === null ? null : report.change <= 0,
      label: "Spent",
      trend: report.months.map((entry) => entry.spent),
      value: empty ? null : report.spent,
    },
    {
      delta:
        typicalDaily === 0
          ? "No history yet"
          : `${percent.format(Math.abs(report.dailyAverage / typicalDaily - 1))} vs 6-month average`,
      good: typicalDaily === 0 ? null : report.dailyAverage <= typicalDaily,
      label: "Daily average",
      value: empty ? null : report.dailyAverage,
    },
    {
      delta: sameIncome
        ? `Same as ${previousName}`
        : `${percent.format(Math.abs(incomeChange))} vs ${previousName}`,
      good: sameIncome ? null : report.income > previousIncome,
      label: "Income",
      value: noIncome ? null : report.income,
    },
    {
      delta: noIncome
        ? "No income yet"
        : `${percent.format(kept / report.income)} of income`,
      good: noIncome ? null : kept >= 0,
      label: "Kept",
      value: noIncome ? null : kept,
    },
  ];
};

const MonthPicker = ({ month }: { month: string }) => (
  <div className="border-border-control flex overflow-hidden rounded-[10px] border bg-white">
    <Link
      to="."
      search={(previous) => ({ ...previous, month: previousMonth(month) })}
      aria-label="Previous month"
      className="flex size-8 items-center justify-center border-r border-gray-200"
    >
      <ChevronLeft className="size-[15px]" />
    </Link>
    <span className="flex h-8 items-center gap-2 px-3 text-[13px] font-medium">
      <CalendarDays className="size-3.5" aria-hidden />
      {monthName(month)} {monthYear(month)}
    </span>
    <Link
      to="."
      search={(previous) => ({ ...previous, month: nextMonth(month) })}
      aria-label="Next month"
      className="flex size-8 items-center justify-center border-l border-gray-200"
    >
      <ChevronRight className="size-[15px]" />
    </Link>
  </div>
);

const SpendingTable = ({ report }: { report: SpendingReport }) => (
  <Card
    title="Spending table"
    subtitle="Every category this month, with its usual range"
  >
    <table className="w-full text-left text-sm font-medium">
      <thead className="text-text-tertiary text-xs">
        <tr>
          <th className="py-2">Category</th>
          <th className="py-2 text-right">Spent</th>
          <th className="py-2 text-right">Share</th>
          <th className="py-2 text-right">Usual low</th>
          <th className="py-2 text-right">Usual high</th>
        </tr>
      </thead>
      <tbody>
        {report.categories.map((category) => (
          <tr key={category.id} className="border-border-subtle border-t">
            <td className="py-2.5">{category.name}</td>
            <td className="text-right">
              <Money cents={category.spent} />
            </td>
            <td className="tabular text-right">
              {percent.format(category.share)}
            </td>
            <td className="text-right">
              {category.usual ? <Money cents={category.usual.low} /> : "—"}
            </td>
            <td className="text-right">
              {category.usual ? <Money cents={category.usual.high} /> : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </Card>
);

const Charts = ({ report, name }: { report: SpendingReport; name: string }) => {
  // The three biggest groups keep their colors; the rest share "Other".
  const colors = new Map(
    report.groups
      .slice(0, 3)
      .map((group, index) => [group.id, PALETTE[index] ?? "var(--chart-other)"])
  );

  const other = report.groups
    .slice(3)
    .reduce((sum, group) => sum + group.spent, 0);

  const empty = report.spent === 0;

  return (
    <>
      <div className="flex gap-5">
        <Card
          className="min-w-0 flex-[1.7]"
          title="Spending pace"
          subtitle="Cumulative spending through the month, against a typical month"
          legend={
            <div className="flex gap-4">
              <Key
                swatch="h-0.5 w-3.5 rounded-sm bg-text-primary"
                label={name}
              />
              <Key
                swatch="h-0.5 w-3.5 rounded-sm bg-gray-400"
                label="Typical"
              />
              <Key
                swatch="h-2.5 w-3.5 rounded-sm bg-[rgb(142_150_164/0.18)]"
                label="Usual range"
              />
            </div>
          }
        >
          {empty ? (
            <div className="flex h-[300px] flex-col items-center justify-center gap-3 text-center">
              <span className="shadow-card flex size-12 items-center justify-center rounded-[14px] bg-white">
                <ChartLine
                  className="text-text-tertiary size-[22px]"
                  aria-hidden
                />
              </span>
              <p className="text-[15px] font-semibold">
                No spending in {name} yet
              </p>
              <p className="text-text-tertiary max-w-[360px] text-[13px] leading-5 font-medium">
                Import a bank file or add a transaction. The pace chart fills in
                as the month goes.
              </p>
              <Button variant="outline">
                <FileUp />
                Import transactions
              </Button>
            </div>
          ) : (
            <PaceChart pace={report.pace} />
          )}
        </Card>
        <Card
          className="min-w-[420px] flex-1"
          title="Daily spending"
          subtitle="Darker days cost more"
        >
          <Heatmap
            days={report.days}
            weekendRatio={empty ? null : report.weekendRatio}
          />
        </Card>
      </div>
      <Card
        title="By group"
        subtitle={`${name} against each group’s last 6 months`}
        legend={
          <div className="flex gap-4">
            <Key
              swatch="h-2 w-3.5 rounded-full bg-gray-200"
              label="Usual range"
            />
            <Key
              swatch="h-3 w-0.5 rounded-sm bg-text-tertiary"
              label="Average"
            />
            <Key
              swatch="size-[9px] rounded-full bg-text-primary"
              label={name}
            />
          </div>
        }
      >
        {empty ? (
          <p className="text-text-tertiary py-6 text-center text-[13px] font-medium">
            Groups appear here once {name} has spending. Ranges need at least 2
            months of history.
          </p>
        ) : (
          <>
            <div className="flex h-2 gap-0.5" aria-hidden>
              {report.groups.slice(0, 3).map((group) => (
                <span
                  key={group.id}
                  className="rounded-sm"
                  style={{
                    background: colors.get(group.id),
                    flex: group.spent,
                  }}
                />
              ))}
              {other > 0 ? (
                <span
                  className="bg-chart-other rounded-sm"
                  style={{ flex: other }}
                />
              ) : null}
            </div>
            <GroupRanges report={report} colors={colors} />
          </>
        )}
      </Card>
    </>
  );
};

const ReflectScreen = () => {
  const month = monthFromSearch(Route.useSearch());
  const { data, groups } = useBudget();
  const [view, setView] = useState<"charts" | "table">("charts");

  const report = useMemo(
    () => spendingReport({ ...data, groups }, month),
    [data, groups, month]
  );

  const previousIncome = useMemo(
    () =>
      data.transactions
        .filter(
          (row) =>
            row.categoryId === READY_TO_ASSIGN &&
            !row.transfer &&
            row.date.startsWith(previousMonth(month))
        )
        .reduce((sum, row) => sum + row.amount, 0),
    [data, month]
  );

  const pastMonths = report.months
    .slice(-7, -1)
    .filter((entry) => entry.spent > 0);

  const typicalDaily =
    pastMonths.length === 0
      ? 0
      : pastMonths.reduce((sum, entry) => sum + entry.spent, 0) /
        pastMonths.length /
        30.4;

  const name = monthName(month);

  const figures: Figures = {
    name,
    previousIncome,
    previousName: monthName(previousMonth(month)),
    report,
    typicalDaily,
  };

  return (
    <>
      <div className="border-border flex h-[52px] shrink-0 items-center justify-between border-b px-10">
        <nav className="flex items-center gap-7" aria-label="Reports">
          {TABS.map((tab, index) => (
            <span
              key={tab}
              aria-current={index === 0 ? "page" : undefined}
              title={index === 0 ? undefined : "Coming soon"}
              className={cn(
                "flex h-[52px] items-center text-sm font-medium",
                index === 0
                  ? "shadow-[inset_0_-2px_0_var(--text-primary)]"
                  : "text-text-tertiary"
              )}
            >
              {tab}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} />
          <Button variant="outline">
            All accounts
            <ChevronDown />
          </Button>
          <Button variant="outline">
            Compare: last 6 months
            <ChevronDown />
          </Button>
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { label: "Charts", value: "charts" },
              { label: "Table", value: "table" },
            ]}
          />
          <Button variant="ghost" size="icon" aria-label="Export">
            <Download />
          </Button>
        </div>
      </div>
      <div className="bg-surface-app flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-10 py-9">
        <h1 className="max-w-[1200px] text-[32px] leading-[38px] font-semibold tracking-tight">
          {headlineFor(figures)}
        </h1>
        <KpiStrip kpis={kpisFor(figures)} />
        {view === "table" ? (
          <SpendingTable report={report} />
        ) : (
          <Charts report={report} name={name} />
        )}
      </div>
    </>
  );
};

export const Route = createFileRoute("/reflect")({ component: ReflectScreen });
