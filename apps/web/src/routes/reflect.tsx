import { createFileRoute, Link } from "@tanstack/react-router";
import { addMonths, monthsBetween } from "@ynabe/budget";
import { rangeReport } from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@ynabe/ui/components/ui/dropdown-menu";
import { cn } from "@ynabe/ui/lib/utils";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import {
  Card,
  DailySpending,
  HeatmapKey,
  MonthlySpending,
  NetWorth,
  SpendingDonut,
} from "../components/reflect/parts";
import { RangeSlider } from "../components/reflect/range-slider";
import {
  currentMonth,
  monthName,
  monthShort,
  monthYear,
  rangeFromSearch,
  useBudget,
} from "../data/use-budget";

const ALL = "all";
const GROUP = "group:";

interface Range {
  from: string;
  to: string;
}

/** `October 2026`, `Aug – Oct 2026` or `Nov 2025 – Oct 2026`, year in grey. */
const RangeTitle = ({ from, to }: Range) => {
  let text = `${monthShort(from)} ${monthYear(from)} – ${monthShort(to)}`;

  if (from === to) {
    text = monthName(to);
  } else if (monthYear(from) === monthYear(to)) {
    text = `${monthShort(from)} – ${monthShort(to)}`;
  }

  return (
    <h1 className="text-[40px] leading-[44px] font-semibold tracking-tight">
      {text} <span className="text-text-disabled">{monthYear(to)}</span>
    </h1>
  );
};

const Step = ({
  range,
  label,
  children,
}: {
  range: Range;
  label: string;
  children: React.ReactNode;
}) => (
  <Button
    variant="outline"
    size="icon"
    aria-label={label}
    nativeButton={false}
    render={
      <Link to="." search={(previous) => ({ ...previous, ...range })} replace />
    }
  >
    {children}
  </Button>
);

const Figure = ({ label, cents }: { label: string; cents: number }) => (
  <div className="flex flex-col items-end">
    <Money
      cents={cents}
      className="text-xl leading-7 font-semibold tracking-tight"
    />
    <span className="text-text-tertiary text-xs font-medium">{label}</span>
  </div>
);

const Operator = ({ children }: { children: string }) => (
  <span className="text-text-disabled self-start text-xl leading-7" aria-hidden>
    {children}
  </span>
);

/** Income minus spending is what was kept. A category filter hides income. */
const Statement = ({
  income,
  spent,
  filtered,
}: {
  income: number;
  spent: number;
  filtered: boolean;
}) => {
  if (filtered) {
    return <Figure label="Spent" cents={spent} />;
  }

  const kept = income - spent;

  return (
    <div className="flex items-center gap-5">
      <Figure label="Income" cents={income} />
      <Operator>−</Operator>
      <Figure label="Spent" cents={spent} />
      <Operator>=</Operator>
      <div
        className={cn(
          "flex flex-col rounded-[14px] border px-5 py-2.5",
          kept < 0
            ? "border-over-border bg-[linear-gradient(180deg,#fff5f5,#ffe6e7)]"
            : "border-funded-border bg-[linear-gradient(180deg,#f2fdf7,#e0fced)]"
        )}
      >
        <Money
          cents={kept}
          className={cn(
            "text-[28px] leading-8 font-semibold tracking-tight",
            kept < 0 ? "text-over" : "text-[#005c3d]"
          )}
        />
        <span
          className={cn(
            "text-xs font-medium",
            kept < 0 ? "text-over" : "text-funded"
          )}
        >
          {kept < 0 || income <= 0
            ? "Kept"
            : `Kept · ${Math.round((kept / income) * 100)}% of income`}
        </span>
      </div>
    </div>
  );
};

interface Option {
  value: string;
  label: string;
  /** Indented under the option before it. */
  nested?: boolean;
}

const Filter = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button variant="outline" size="lg" aria-label={label} />}
    >
      <span className="max-w-[180px] truncate">
        {options.find((option) => option.value === value)?.label ??
          options[0]?.label}
      </span>
      <ChevronDown />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="max-h-96 w-64 overflow-y-auto">
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => onChange(String(next))}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            className={cn(
              option.nested ? "text-text-secondary pl-5" : "font-medium"
            )}
          >
            <span className="truncate">{option.label}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const PRESETS = ["1M", "3M", "6M", "1Y", "YTD", "All"] as const;

const presetRange = (
  preset: (typeof PRESETS)[number],
  today: string,
  first: string
): Range => {
  const back = { "1M": 0, "1Y": 11, "3M": 2, "6M": 5 } as const;

  if (preset === "YTD") {
    return { from: `${monthYear(today)}-01`, to: today };
  }

  if (preset === "All") {
    return { from: first, to: today };
  }

  return { from: addMonths(today, -back[preset]), to: today };
};

const ReflectScreen = () => {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { from, to } = rangeFromSearch(search);
  const { accounts, categories, groups, ledger } = useBudget();
  const today = currentMonth();

  const accountId = accounts.some((account) => account.id === search.account)
    ? search.account
    : undefined;

  const category = search.category ?? ALL;

  const categoryIds = useMemo(() => {
    if (category.startsWith(GROUP)) {
      const groupId = category.slice(GROUP.length);

      return new Set(
        categories
          .filter((entry) => entry.groupId === groupId)
          .map((entry) => entry.id)
      );
    }

    return categories.some((entry) => entry.id === category)
      ? new Set([category])
      : undefined;
  }, [categories, category]);

  const report = useMemo(
    () =>
      rangeReport(
        { categories, groups, transactions: ledger },
        { accountId, categoryIds, from, to, today }
      ),
    [accountId, categories, categoryIds, from, groups, ledger, to, today]
  );

  const setRange = (range: Range) =>
    navigate({
      replace: true,
      search: (previous) => ({ ...previous, ...range }),
    });

  const setFilter = (key: "account" | "category", value: string) =>
    navigate({
      replace: true,
      search: (previous) => ({
        ...previous,
        [key]: value === ALL ? undefined : value,
      }),
    });

  const length = monthsBetween(from, to) + 1;
  const first = report.history[0]?.month ?? from;

  const accountOptions: Option[] = [
    { label: "All accounts", value: ALL },
    ...accounts.map((account) => ({ label: account.name, value: account.id })),
  ];

  const categoryOptions: Option[] = [
    { label: "All categories", value: ALL },
    ...groups.flatMap((group) => [
      { label: group.name, value: `${GROUP}${group.id}` },
      ...categories
        .filter((entry) => entry.groupId === group.id)
        .map((entry) => ({ label: entry.name, nested: true, value: entry.id })),
    ]),
  ];

  return (
    <div className="bg-surface-app flex min-h-0 flex-1 flex-col overflow-y-auto">
      <section className="flex flex-col gap-4 px-10 pt-7 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <RangeTitle from={from} to={to} />
            <div className="flex gap-1">
              <Step
                label="Earlier"
                range={{
                  from: addMonths(from, -length),
                  to: addMonths(to, -length),
                }}
              >
                <ChevronLeft />
              </Step>
              <Step
                label="Later"
                range={{
                  from: addMonths(from, length),
                  to: addMonths(to, length),
                }}
              >
                <ChevronRight />
              </Step>
            </div>
          </div>
          <Statement
            income={report.income}
            spent={report.spent}
            filtered={categoryIds !== undefined}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <fieldset className="bg-surface-sunken m-0 flex h-10 items-center gap-0.5 rounded-[10px] border-0 p-[3px]">
            <legend className="sr-only">Quick ranges</legend>
            {PRESETS.map((preset) => {
              const range = presetRange(preset, today, first);
              const active = range.from === from && range.to === to;

              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRange(range)}
                  className={cn(
                    "focus-visible:ring-ring/50 h-[34px] cursor-pointer rounded-lg px-3 text-[13px] outline-none focus-visible:ring-3",
                    active
                      ? "bg-white font-semibold shadow-xs"
                      : "text-text-secondary hover:text-text-primary font-medium"
                  )}
                >
                  {preset}
                </button>
              );
            })}
          </fieldset>
          <RangeSlider
            history={report.history}
            from={from}
            to={to}
            onChange={(nextFrom, nextTo) =>
              setRange({ from: nextFrom, to: nextTo })
            }
          />
          <Filter
            label="Account"
            options={accountOptions}
            value={accountId ?? ALL}
            onChange={(value) => setFilter("account", value)}
          />
          <Filter
            label="Category"
            options={categoryOptions}
            value={categoryIds === undefined ? ALL : category}
            onChange={(value) => setFilter("category", value)}
          />
        </div>
      </section>
      <div className="flex flex-col gap-5 px-10 pb-10">
        <Card title="Monthly spending">
          <MonthlySpending months={report.months} />
        </Card>
        <Card title="Daily spending" aside={<HeatmapKey />}>
          <DailySpending calendar={report.calendar} />
        </Card>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(480px,1fr))] gap-5">
          <Card
            title={
              categoryIds === undefined
                ? "Spending by group"
                : "Spending by category"
            }
          >
            <SpendingDonut slices={report.slices} spent={report.spent} />
          </Card>
          <Card title="Net worth">
            <NetWorth months={report.months} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export const Route = createFileRoute("/reflect")({ component: ReflectScreen });
