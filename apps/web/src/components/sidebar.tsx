import { Link } from "@tanstack/react-router";
import { Kbd } from "@ynabe/ui/components/ui/kbd";
import { ChartPie, Landmark, LayoutGrid, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const nav: {
  to: "/plan" | "/accounts" | "/reflect";
  label: string;
  icon: LucideIcon;
  key: string;
}[] = [
  { icon: LayoutGrid, key: "1", label: "Plan", to: "/plan" },
  { icon: ChartPie, key: "2", label: "Reflect", to: "/reflect" },
  { icon: Landmark, key: "3", label: "Accounts", to: "/accounts" },
];

export const Sidebar = () => (
  <aside className="border-sidebar-border bg-sidebar flex w-[272px] shrink-0 flex-col gap-0.5 border-r px-2.5 py-3">
    <div className="flex h-11 items-center gap-2 px-1.5">
      <div className="bg-text-primary size-6 rounded-[7px]" />
      <span className="text-sm font-semibold tracking-tight">ynabe</span>
    </div>
    <button
      type="button"
      className="border-border text-text-tertiary my-2 flex h-8 items-center gap-2 rounded-lg border bg-white px-2 text-[13px] font-medium"
    >
      <Search className="size-3.5" />
      <span className="flex-1 text-left">Quick actions</span>
      <Kbd>⌘K</Kbd>
    </button>
    {nav.map(({ to, label, icon: Icon, key }) => (
      <Link
        key={to}
        to={to}
        className="text-gray-850 flex h-[30px] items-center gap-2 rounded-lg px-2 text-[13px] font-medium"
        activeProps={{ className: "bg-white shadow-xs" }}
      >
        <Icon className="text-text-tertiary size-[15px]" />
        <span className="flex-1">{label}</span>
        <Kbd>{key}</Kbd>
      </Link>
    ))}
  </aside>
);
