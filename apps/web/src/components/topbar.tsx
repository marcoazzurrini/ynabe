import type { LucideIcon } from "lucide-react";

import { MonthControl } from "./month-control";

interface TopbarProps {
  icon: LucideIcon;
  title: string;
  /** Shows the shared month switcher on screens that follow the month. */
  month?: string;
}

/** The bar at the top of a screen: where you are, and the month. */
export const Topbar = ({ icon: Icon, title, month }: TopbarProps) => (
  <div className="border-border flex h-[52px] shrink-0 items-center justify-between border-b px-5">
    <p className="text-text-tertiary flex items-center gap-2 text-[13px] font-medium">
      <Icon className="size-[15px]" aria-hidden />
      <span className="text-text-primary">{title}</span>
    </p>
    {month ? <MonthControl month={month} /> : null}
  </div>
);
