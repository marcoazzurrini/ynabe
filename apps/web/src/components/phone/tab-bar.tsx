import { Link } from "@tanstack/react-router";
import { cn } from "@ynabe/ui/lib/utils";
import { ChartPie, Landmark, LayoutList, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAgent } from "../agent/state";

interface Tab {
  to: "/plan" | "/accounts" | "/reflect";
  label: string;
  icon: LucideIcon;
}

const tabs: Tab[] = [
  { icon: LayoutList, label: "Plan", to: "/plan" },
  { icon: Landmark, label: "Accounts", to: "/accounts" },
  { icon: ChartPie, label: "Reflect", to: "/reflect" },
];

const item =
  "flex h-[52px] w-[74px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-transform duration-100 ease-out outline-none active:scale-[0.97]";

const on = "bg-(--gray-150) text-text-primary";
const off = "text-text-tertiary";

/**
 * The phone's navigation: a pill that floats over the screen. The
 * assistant is its fourth tab, since a phone has no room for a side panel.
 */
export const TabBar = () => {
  const { open, setOpen } = useAgent();

  return (
    <nav
      aria-label="Screens"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="border-border pointer-events-auto flex gap-0.5 rounded-full border bg-white/80 p-1 shadow-[0_8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl">
        {tabs.map(({ icon: Icon, label, to }) => (
          <Link
            key={to}
            to={to}
            search={(previous) => previous}
            onClick={() => setOpen(false)}
            className={item}
            activeProps={{ className: open ? off : on }}
            inactiveProps={{ className: off }}
          >
            <Icon className="size-[22px]" aria-hidden />
            {label}
          </Link>
        ))}
        <button
          type="button"
          aria-pressed={open}
          onClick={() => setOpen(true)}
          className={cn(item, open ? on : off)}
        >
          <Sparkles className="size-[22px]" aria-hidden />
          Ledger
        </button>
      </div>
    </nav>
  );
};
