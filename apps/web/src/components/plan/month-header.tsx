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
} from "lucide-react";

import {
  monthName,
  monthYear,
  nextMonth,
  previousMonth,
} from "../../data/use-budget";
import { useAgent } from "../agent/state";
import { BackToToday } from "../month-control";

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
}

/** The month as the page title, with arrows to step through months. */
const MonthTitle = ({ month }: { month: string }) => (
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
    <BackToToday month={month} />
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

/** The month title with its arrows, and Ready to Assign. */
export const MonthHeader = ({ month, plan, options }: MonthHeaderProps) => (
  <section className="flex flex-col gap-5 px-10 pt-7 pb-6">
    <div className="flex items-center justify-between gap-6">
      <MonthTitle month={month} />
      <ReadyToAssign plan={plan} options={options} />
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
