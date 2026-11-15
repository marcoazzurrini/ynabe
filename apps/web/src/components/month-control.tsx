import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";

import {
  currentMonth,
  monthName,
  monthYear,
  nextMonth,
  previousMonth,
} from "../data/use-budget";

/** A way back to the current month; hidden while you are on it. */
export const BackToToday = ({ month }: { month: string }) => {
  const today = currentMonth();

  return month === today ? null : (
    <Link
      to="."
      search={(previous) => ({ ...previous, month: undefined })}
      className="flex h-8 items-center gap-1.5 rounded-lg bg-(--blue-tint) px-2.5 text-xs font-semibold whitespace-nowrap text-(--blue-ink)"
    >
      <Undo2 className="size-[13px]" aria-hidden />
      Back to {monthName(today)}
    </Link>
  );
};

/**
 * The month switcher every screen shares. The month lives in `?month=`, so
 * it follows you between screens; away from today it offers a way back.
 */
export const MonthControl = ({ month }: { month: string }) => (
  <div className="flex items-center gap-2">
    <div className="border-border-control flex overflow-hidden rounded-[10px] border bg-white">
      <Link
        to="."
        search={(previous) => ({ ...previous, month: previousMonth(month) })}
        aria-label="Previous month"
        className="hover:bg-surface-app flex size-8 items-center justify-center border-r border-gray-200"
      >
        <ChevronLeft className="size-[15px]" aria-hidden />
      </Link>
      <span className="flex h-8 items-center gap-2 px-3 text-[13px] font-medium">
        <CalendarDays className="size-3.5" aria-hidden />
        {monthName(month)} {monthYear(month)}
      </span>
      <Link
        to="."
        search={(previous) => ({ ...previous, month: nextMonth(month) })}
        aria-label="Next month"
        className="hover:bg-surface-app flex size-8 items-center justify-center border-l border-gray-200"
      >
        <ChevronRight className="size-[15px]" aria-hidden />
      </Link>
    </div>
    <BackToToday month={month} />
  </div>
);
