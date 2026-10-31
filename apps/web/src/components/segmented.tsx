import { cn } from "@ynabe/ui/lib/utils";

export interface SegmentOption<Value extends string> {
  value: Value;
  label: string;
  count?: number;
}

interface SegmentedProps<Value extends string> {
  label: string;
  options: readonly SegmentOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
}

/** Filter chips in a sunken well; the chosen one lifts onto white. */
export const Segmented = <Value extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<Value>) => (
  <fieldset className="bg-surface-sunken m-0 flex items-center gap-1 rounded-[10px] border-0 p-[3px]">
    <legend className="sr-only">{label}</legend>
    {options.map((option) => {
      const active = option.value === value;

      return (
        <label
          key={option.value}
          className={cn(
            "has-focus-visible:ring-ring/50 flex h-7 cursor-pointer items-center gap-1 rounded-lg border px-2.5 text-[13px] font-medium has-focus-visible:ring-3",
            active
              ? "border-border-control text-text-primary bg-white shadow-[0_1px_1px_rgb(0_0_0/0.04)]"
              : "hover:text-text-primary border-transparent text-gray-600"
          )}
        >
          <input
            type="radio"
            name={label}
            value={option.value}
            checked={active}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
          {option.count === undefined ? null : (
            <span className="text-text-tertiary text-[11px]">
              {option.count}
            </span>
          )}
        </label>
      );
    })}
  </fieldset>
);
