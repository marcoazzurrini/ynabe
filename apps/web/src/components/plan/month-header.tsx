import { Link } from "@tanstack/react-router";
import type { MonthPlan } from "@ynabe/budget";
import { Money } from "@ynabe/ui/components/money";
import { Button } from "@ynabe/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@ynabe/ui/components/ui/dropdown-menu";
import { cn } from "@ynabe/ui/lib/utils";
import {
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Wrench,
  Zap,
} from "lucide-react";

import {
  monthName,
  monthYear,
  nextMonth,
  previousMonth,
} from "../../data/use-budget";
import { useAgent } from "../agent/state";

export interface AutoAssignOption {
  label: string;
  /** What the option would assign in total, in cents. */
  amount: number;
  run: () => void;
}

interface MonthHeaderProps {
  month: string;
  plan: MonthPlan;
  options: readonly AutoAssignOption[];
  onFundAll: () => void;
}

const MonthNav = ({ month }: { month: string }) => (
  <div className="flex items-center gap-4">
    <h1 className="text-[40px] leading-[44px] font-semibold tracking-tight">
      {monthName(month)}{" "}
      <span className="text-text-disabled">{monthYear(month)}</span>
    </h1>
    <div className="flex gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        nativeButton={false}
        render={
          <Link
            to="."
            search={(previous) => ({
              ...previous,
              month: previousMonth(month),
            })}
          />
        }
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        nativeButton={false}
        render={
          <Link
            to="."
            search={(previous) => ({ ...previous, month: nextMonth(month) })}
          />
        }
      >
        <ChevronRight />
      </Button>
    </div>
  </div>
);

const amountTone = (cents: number) => {
  if (cents < 0) {
    return "text-over";
  }

  return cents === 0 ? "text-text-primary" : "text-[#005c3d]";
};

const captionTone = (cents: number) => {
  if (cents < 0) {
    return "text-over";
  }

  return cents === 0 ? "text-text-tertiary" : "text-funded";
};

const ReadyToAssign = ({
  plan,
  options,
}: {
  plan: MonthPlan;
  options: readonly AutoAssignOption[];
}) => {
  const { open, toggle } = useAgent();
  const negative = plan.readyToAssign < 0;
  const zero = plan.readyToAssign === 0;

  let tone =
    "border-funded-border bg-[linear-gradient(180deg,#f2fdf7,#e0fced)]";

  let caption = "Ready to assign";

  if (negative) {
    tone = "border-over-border bg-[linear-gradient(180deg,#fff5f5,#ffe6e7)]";
    caption = "You assigned more than you have";
  } else if (zero) {
    tone = "border-border bg-[linear-gradient(180deg,#fafafa,#f2f3f5)]";
    caption = "All money assigned";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-6 rounded-[14px] border py-3 pr-3 pl-5",
        tone
      )}
    >
      <div className="flex flex-col">
        <Money
          cents={plan.readyToAssign}
          className={cn(
            "text-[28px] leading-8 font-semibold tracking-tight",
            amountTone(plan.readyToAssign)
          )}
        />
        <span
          className={cn("text-xs font-medium", captionTone(plan.readyToAssign))}
        >
          {caption}
        </span>
      </div>
      {negative ? (
        <Button variant="outline" onClick={open ? undefined : toggle}>
          <Wrench />
          Fix
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="positive" size="lg" />}>
            Assign
            <ChevronDown />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Auto-assign</DropdownMenuLabel>
            </DropdownMenuGroup>
            {options.map((option) => (
              <DropdownMenuItem
                key={option.label}
                onClick={() => option.run()}
                className="justify-between"
              >
                {option.label}
                <Money cents={option.amount} className="text-text-tertiary" />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

const FundingMeter = ({
  month,
  plan,
  onFundAll,
}: {
  month: string;
  plan: MonthPlan;
  onFundAll: () => void;
}) => {
  const withTargets = plan.categories.filter(
    (category) =>
      category.status !== "empty" &&
      (category.needed > 0 ||
        category.status === "funded" ||
        category.status === "overspent")
  );

  const under = plan.categories.filter(
    (category) => category.status === "underfunded"
  ).length;

  const over = plan.categories.filter(
    (category) => category.status === "overspent"
  ).length;

  const onTrack = Math.max(0, withTargets.length - under - over);
  const negative = plan.readyToAssign < 0;

  const segments = [
    {
      color: "bg-progress-funded",
      count: onTrack,
      label: `${onTrack} on track`,
    },
    { color: "bg-progress-under", count: under, label: `${under} need ` },
    { color: "bg-progress-over", count: over, label: `${over} overspent` },
  ];

  return (
    <div className="shadow-card flex max-w-[640px] flex-1 flex-col gap-3 rounded-[14px] bg-white px-5 py-4">
      <div className="flex items-baseline justify-between gap-4">
        <p>
          <span className="text-[22px] font-semibold tracking-tight">
            {Math.round(plan.funded * 100)}%
          </span>
          <span className="text-text-tertiary text-[13px] font-medium">
            {" "}
            of {monthName(month)}’s targets funded
          </span>
        </p>
        <Button
          variant="outline"
          disabled={under === 0 || negative}
          onClick={onFundAll}
        >
          <Zap />
          {negative ? (
            "Fix over-assignment first"
          ) : (
            <>
              Fund {under} {under === 1 ? "category" : "categories"} ·{" "}
              <Money cents={plan.attention.needed} />
            </>
          )}
        </Button>
      </div>
      <div className="flex h-1.5 gap-1">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.color}
              className={cn("rounded-full", segment.color)}
              style={{ flex: segment.count }}
            />
          ) : null
        )}
      </div>
      <ul className="text-text-tertiary flex gap-5 text-xs font-medium">
        {segments.map((segment, index) => (
          <li key={segment.color} className="flex items-center gap-2">
            <span className={cn("size-2 rounded-[2px]", segment.color)} />
            {segment.label}
            {index === 1 ? <Money cents={plan.attention.needed} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

const Stat = ({ label, cents }: { label: string; cents: number }) => (
  <p className="flex justify-between gap-6 text-[13px] font-medium">
    <span className="text-text-tertiary">{label}</span>
    <Money cents={cents} className="text-text-secondary" />
  </p>
);

/** Month picker, Ready to Assign, target funding, and the month in numbers. */
export const MonthHeader = ({
  month,
  plan,
  options,
  onFundAll,
}: MonthHeaderProps) => {
  const leftOver = plan.available - plan.assigned - plan.activity;

  return (
    <section className="flex flex-col gap-6 px-10 pt-9 pb-7">
      <MonthNav month={month} />
      <div className="flex items-stretch gap-5">
        <ReadyToAssign plan={plan} options={options} />
        <FundingMeter month={month} plan={plan} onFundAll={onFundAll} />
        <div className="border-border-subtle flex w-[260px] flex-col justify-center gap-2 border-l pl-5">
          <Stat
            label={`Left over from ${monthName(previousMonth(month)).slice(0, 3)}`}
            cents={leftOver}
          />
          <Stat
            label={`Assigned in ${monthName(month).slice(0, 3)}`}
            cents={plan.assigned}
          />
          <Stat
            label={`Spent in ${monthName(month).slice(0, 3)}`}
            cents={-plan.activity}
          />
        </div>
      </div>
      {plan.readyToAssign < 0 ? (
        <p className="bg-over-bg text-over ring-over-border flex items-center gap-3 rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium ring-1 ring-inset">
          <CircleAlert className="size-[15px]" aria-hidden />
          <span className="flex-1">
            You’ve assigned <Money cents={-plan.readyToAssign} /> more than you
            have. Take it back from a category to fix it.
          </span>
          <Button variant="outline">
            Show where it went
            <ArrowRight />
          </Button>
        </p>
      ) : null}
    </section>
  );
};
