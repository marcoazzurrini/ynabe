import { Button } from "@ynabe/ui/components/ui/button";
import { cn } from "@ynabe/ui/lib/utils";
import {
  ArrowRightLeft,
  Check,
  ChevronRight,
  CircleCheck,
  Pencil,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** The assistant speaks on the shared left edge, without an avatar. */
export const AssistantMessage = ({ children }: { children: ReactNode }) => (
  <p className="text-text-primary text-sm leading-[22px] font-medium">
    {children}
  </p>
);

export const UserMessage = ({ children }: { children: ReactNode }) => (
  <p className="max-w-[420px] self-end rounded-2xl bg-gray-100 px-3.5 py-[9px] text-sm leading-[22px] font-medium">
    {children}
  </p>
);

export interface Step {
  icon: LucideIcon;
  label: string;
}

/** What the assistant looked at, as quiet collapsible lines. */
export const Steps = ({ steps }: { steps: readonly Step[] }) => (
  <ul className="flex flex-col gap-1">
    {steps.map(({ icon: Icon, label }) => (
      <li
        key={label}
        className="text-text-tertiary flex h-[22px] items-center gap-2 text-[13px] font-medium"
      >
        <Icon className="size-3.5" aria-hidden />
        {label}
        <ChevronRight className="size-[13px]" aria-hidden />
      </li>
    ))}
  </ul>
);

export interface ProposalLine {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  positive?: boolean;
}

interface ProposalProps {
  title: string;
  lines: readonly ProposalLine[];
  footnote: string;
  applied: boolean;
  appliedLabel: string;
  onApply: () => void;
}

/** A change the assistant proposes. Nothing happens until it is applied. */
export const Proposal = ({
  title,
  lines,
  footnote,
  applied,
  appliedLabel,
  onApply,
}: ProposalProps) => {
  if (applied) {
    return (
      <p className="bg-funded-bg text-funded ring-funded-border flex items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-medium ring-1 ring-inset">
        <CircleCheck className="size-[13px]" aria-hidden />
        {appliedLabel}
      </p>
    );
  }

  return (
    <section className="shadow-card overflow-hidden rounded-xl bg-white">
      <header className="border-border-subtle flex items-center gap-2 border-b px-3.5 py-3">
        <span className="bg-funded-bg flex size-[22px] items-center justify-center rounded-md">
          <ArrowRightLeft className="text-funded size-3" aria-hidden />
        </span>
        <span className="flex-1 text-[13px] font-semibold">{title}</span>
        <span className="text-text-tertiary text-[11px] font-medium">
          Proposed
        </span>
      </header>
      <ul className="flex flex-col gap-2 px-3.5 py-3 text-[13px] font-medium">
        {lines.map((line) => (
          <li key={line.label} className="flex items-center gap-3">
            <span className="flex w-[15px] justify-center">{line.icon}</span>
            <span className="flex-1">{line.label}</span>
            <span
              className={cn(
                "tabular",
                line.positive ? "text-funded" : "text-text-secondary"
              )}
            >
              {line.value}
            </span>
          </li>
        ))}
      </ul>
      <footer className="border-border-subtle bg-surface-sunken flex items-center gap-2 border-t px-3.5 py-2.5">
        <span className="text-text-tertiary flex-1 text-xs font-medium">
          {footnote}
        </span>
        <Button variant="ghost">
          <Pencil />
          Edit
        </Button>
        <Button onClick={onApply}>
          <Check />
          Apply
        </Button>
      </footer>
    </section>
  );
};

export interface Suggestion {
  icon: LucideIcon;
  label: string;
  run: () => void;
}

export const Suggestions = ({
  suggestions,
}: {
  suggestions: readonly Suggestion[];
}) => (
  <div className="flex flex-wrap gap-2">
    {suggestions.map(({ icon: Icon, label, run }) => (
      <button
        key={label}
        type="button"
        onClick={run}
        className="border-border text-text-secondary hover:border-border-control hover:text-text-primary flex h-[30px] items-center gap-1 rounded-full border bg-white px-3 text-[13px] font-medium"
      >
        <Icon className="text-text-tertiary size-3" aria-hidden />
        {label}
      </button>
    ))}
  </div>
);
