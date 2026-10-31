import { Link } from "@tanstack/react-router";
import { ageOfMoney } from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ynabe/ui/components/ui/dropdown-menu";
import { Kbd } from "@ynabe/ui/components/ui/kbd";
import {
  ChartPie,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Landmark,
  LayoutGrid,
  Link2,
  LogOut,
  PanelLeft,
  Plus,
  Repeat,
  Search,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";

import { signOut, useSession } from "../data/session";
import { useBudget } from "../data/use-budget";
import { AccountMark } from "./account-mark";

interface NavItem {
  to: "/plan" | "/reflect" | "/accounts" | "/scheduled";
  label: string;
  icon: LucideIcon;
  shortcut: string;
}

const nav: NavItem[] = [
  { icon: LayoutGrid, label: "Plan", shortcut: "1", to: "/plan" },
  { icon: ChartPie, label: "Reflect", shortcut: "2", to: "/reflect" },
  { icon: Landmark, label: "All Accounts", shortcut: "3", to: "/accounts" },
  { icon: Repeat, label: "Scheduled", shortcut: "4", to: "/scheduled" },
];

const SectionLabel = ({ label, total }: { label: string; total: number }) => (
  <p className="text-text-tertiary flex items-center justify-between px-2 pt-4 pb-1.5 text-xs font-medium">
    <span className="flex items-center gap-1">
      <ChevronDown className="size-3" aria-hidden />
      {label}
    </span>
    <Money cents={total} />
  </p>
);

/** Navigation, accounts and balances, and the age of money. */
const Avatar = ({ image }: { image: string | null }) =>
  image ? (
    <img
      src={image}
      alt=""
      referrerPolicy="no-referrer"
      className="size-[22px] rounded-full"
    />
  ) : (
    <span className="size-[22px] rounded-full border-2 border-white bg-[linear-gradient(135deg,#9b69ff,#266df0)]" />
  );

export const Sidebar = () => {
  const { accounts, ledger } = useBudget();
  const session = useSession();
  const me = session.status === "signed-in" ? session.account : null;
  const firstName = me?.name.split(" ")[0] ?? "";

  const balances = useMemo(() => {
    const totals = new Map<string, number>();

    for (const row of ledger) {
      totals.set(row.accountId, (totals.get(row.accountId) ?? 0) + row.amount);
    }

    return totals;
  }, [ledger]);

  const age = useMemo(() => ageOfMoney(ledger), [ledger]);
  const open = accounts.filter((account) => !account.closed);
  const cash = open.filter((account) => account.kind !== "tracking");
  const tracking = open.filter((account) => account.kind === "tracking");
  const closed = accounts.length - open.length;

  const total = (list: typeof accounts) =>
    list.reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);

  return (
    <aside className="border-sidebar-border bg-sidebar flex w-[272px] shrink-0 flex-col gap-0.5 border-r px-2.5 py-3">
      <button
        type="button"
        className="flex h-11 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-white/60"
      >
        <span className="bg-text-primary relative size-6 shrink-0 rounded-[7px]">
          <span className="absolute top-[6px] left-[7px] h-[11px] w-[2.5px] rounded-full bg-white" />
          <span className="absolute top-[14px] left-[7px] h-[2.5px] w-[9px] rounded-full bg-white" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold tracking-tight">
            {firstName ? `${firstName}’s Budget` : "Budget"}
          </span>
          <span className="text-text-tertiary truncate text-[11px]">
            {me?.email}
          </span>
        </span>
        <ChevronsUpDown className="text-text-tertiary size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        className="border-border text-text-tertiary mt-2 mb-2.5 flex h-8 items-center gap-2 rounded-lg border bg-white px-2 text-[13px] font-medium"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Quick actions</span>
        <Kbd>⌘K</Kbd>
      </button>
      {nav.map(({ to, label, icon: Icon, shortcut }) => (
        <Link
          key={to}
          to={to}
          search={(previous) => previous}
          className="group text-gray-850 flex h-[30px] items-center gap-2 rounded-lg px-2 text-[13px] font-medium"
          activeProps={{ className: "bg-white shadow-xs" }}
        >
          <Icon
            className="group-data-[status=active]:text-text-primary size-[15px] text-gray-600"
            aria-hidden
          />
          <span className="flex-1">{label}</span>
          <Kbd>{shortcut}</Kbd>
        </Link>
      ))}
      <SectionLabel label="Cash" total={total(cash)} />
      {cash.map((account) => (
        <Link
          key={account.id}
          to="/accounts"
          search={{ account: account.id }}
          className="text-gray-850 flex h-[30px] items-center gap-2 rounded-lg px-2 text-[13px] font-medium hover:bg-white/60"
        >
          <AccountMark id={account.id} />
          <span className="flex-1">{account.name}</span>
          <Money
            cents={balances.get(account.id) ?? 0}
            className="text-xs text-gray-600"
          />
        </Link>
      ))}
      <SectionLabel label="Tracking" total={total(tracking)} />
      <p className="text-text-tertiary flex h-[30px] items-center gap-2 px-2 text-[13px] font-medium">
        <ChevronRight className="size-3" aria-hidden />
        Closed
        <span className="text-xs">{closed}</span>
      </p>
      <div className="flex gap-2 px-2 py-3">
        <button
          type="button"
          className="border-border-control text-gray-850 flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border bg-white text-xs font-medium"
        >
          <Plus className="size-[13px]" aria-hidden />
          Account
        </button>
        <button
          type="button"
          className="border-border-control text-gray-850 flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border bg-white text-xs font-medium"
        >
          <Link2 className="size-[13px]" aria-hidden />
          Connect
        </button>
      </div>
      <div className="flex-1" />
      <section className="mb-2.5 flex flex-col gap-2 rounded-[10px] bg-white p-3 text-xs font-medium shadow-xs">
        <p className="flex items-center justify-between">
          Age of money
          <span className="text-funded">
            {age === null ? "—" : `${age} days`}
          </span>
        </p>
        <div className="bg-progress-track h-1 rounded-full">
          <div
            className="bg-progress-funded h-1 rounded-full"
            style={{ width: `${Math.min(100, ((age ?? 0) / 180) * 100)}%` }}
          />
        </div>
        <p className="text-text-tertiary text-[11px] leading-[15px]">
          {age === null
            ? "Shows once you have income and spending."
            : `You’re spending money that’s about ${Math.max(1, Math.round(age / 30))} months old.`}
        </p>
      </section>
      <div className="border-border flex items-center justify-between border-t px-2 pt-2 text-[13px] font-medium text-gray-600">
        <DropdownMenu>
          <DropdownMenuTrigger className="hover:text-text-primary flex items-center gap-2 rounded-md py-0.5 pr-1.5">
            <Avatar image={me?.image ?? null} />
            {firstName}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[248px]">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="text-text-primary text-[13px] font-semibold">
                  {me?.name}
                </span>
                <span className="text-text-tertiary truncate text-[11px] font-medium">
                  {me?.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="flex gap-3">
          <Settings className="size-[15px]" aria-label="Settings" />
          <PanelLeft className="size-[15px]" aria-label="Hide the sidebar" />
        </span>
      </div>
    </aside>
  );
};
