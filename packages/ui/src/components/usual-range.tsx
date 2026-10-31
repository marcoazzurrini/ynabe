import { cn } from "@ynabe/ui/lib/utils";

export interface UsualRangeProps {
  /** This period's value. */
  value: number;
  low: number;
  high: number;
  average: number;
  className?: string;
}

/**
 * Where a value sits against its usual range: a gray band from low to high,
 * a tick at the average, and a dot for the value. The dot turns red only
 * when the value is above the range.
 */
export const UsualRange = ({
  value,
  low,
  high,
  average,
  className,
}: UsualRangeProps) => {
  const domain = Math.max(high, value, 1) * 1.18;
  const at = (amount: number) => `${(amount / domain) * 100}%`;
  const above = value > high;

  return (
    <figure className={cn("relative m-0 h-6 w-full", className)}>
      <figcaption className="sr-only">
        {value} against a usual range of {low} to {high}
      </figcaption>
      <div className="bg-border-subtle absolute inset-x-0 top-[11.5px] h-px" />
      <div
        className="absolute top-2 h-2 rounded-full bg-gray-200"
        style={{ left: at(low), width: `calc(${at(high)} - ${at(low)})` }}
      />
      <div
        className="bg-text-tertiary absolute top-[5px] -ml-px h-3.5 w-0.5 rounded-sm"
        style={{ left: at(average) }}
      />
      <div
        className={cn(
          "absolute top-[7px] -ml-[5px] size-2.5 rounded-full ring-2 ring-white",
          above ? "bg-over" : "bg-text-primary"
        )}
        style={{ left: at(value) }}
      />
    </figure>
  );
};
