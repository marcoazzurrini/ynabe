import { cn } from "@ynabe/ui/lib/utils";

import { Money } from "./money";

export type EnvelopeState =
  | "funded"
  | "available"
  | "underfunded"
  | "overspent"
  | "empty";

export interface EnvelopeProps {
  /** Whole cents available in the category. */
  cents: number;
  state: EnvelopeState;
  /** 0 to 1: how full the category is against its target. */
  progress: number;
  className?: string;
}

const fill: Record<EnvelopeState, string> = {
  available: "bg-envelope-funded",
  empty: "bg-transparent",
  funded: "bg-envelope-funded",
  overspent: "bg-envelope-over",
  underfunded: "bg-envelope-partial",
};

const text: Record<EnvelopeState, string> = {
  available: "text-text-primary",
  empty: "text-text-disabled",
  funded: "text-text-primary",
  overspent: "text-over",
  underfunded: "text-under",
};

/**
 * A category's available money. The bar behind the amount fills toward the
 * target; color only appears when the category needs attention.
 */
export const Envelope = ({
  cents,
  state,
  progress,
  className,
}: EnvelopeProps) => {
  const width = state === "overspent" ? 1 : Math.min(1, Math.max(0, progress));

  return (
    <div
      className={cn(
        "bg-envelope-track relative h-[30px] w-[200px] overflow-hidden rounded-md",
        className
      )}
    >
      <div
        aria-hidden
        className={cn("absolute inset-y-0 left-0", fill[state])}
        style={{ width: `${width * 100}%` }}
      />
      <Money
        cents={cents}
        className={cn(
          "relative block px-2.5 text-right text-[13px] leading-[30px] font-semibold",
          text[state]
        )}
      />
    </div>
  );
};
