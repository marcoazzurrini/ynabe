import { cn } from "@ynabe/ui/lib/utils";

const format = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export interface MoneyProps {
  /** Whole cents. */
  cents: number;
  /** Show `+` on inflows. */
  sign?: boolean;
  /** Color by meaning: inflow green, negative red. Neutral by default. */
  tone?: "neutral" | "meaning";
  className?: string;
}

/** An amount of money, as `1,918.16€`, with figures that line up. */
export const Money = ({
  cents,
  sign = false,
  tone = "neutral",
  className,
}: MoneyProps) => {
  let prefix = "";

  if (cents < 0) {
    prefix = "-";
  } else if (sign && cents > 0) {
    prefix = "+";
  }

  return (
    <span
      className={cn(
        "tabular",
        tone === "meaning" && cents > 0 && "text-inflow",
        tone === "meaning" && cents < 0 && "text-over",
        className
      )}
    >
      {prefix}
      {format.format(Math.abs(cents) / 100)}€
    </span>
  );
};
