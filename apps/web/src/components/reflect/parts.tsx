import type {
  GroupSpending,
  SpendingDay,
  SpendingReport,
} from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import { UsualRange } from "@ynabe/ui/components/usual-range";
import { cn } from "@ynabe/ui/lib/utils";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleAlert,
} from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

export const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  style: "percent",
});

export const Card = ({
  title,
  subtitle,
  legend,
  children,
  className,
}: {
  title: string;
  subtitle: string;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      "shadow-card flex flex-col gap-4 rounded-[14px] bg-white p-6",
      className
    )}
  >
    <header className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="text-text-tertiary text-[13px] font-medium">{subtitle}</p>
      </div>
      {legend}
    </header>
    {children}
  </section>
);

export const Key = ({ swatch, label }: { swatch: string; label: string }) => (
  <span className="text-text-secondary flex items-center gap-2 text-xs font-medium">
    <span className={swatch} />
    {label}
  </span>
);

const Sparkline = ({ values }: { values: readonly number[] }) => {
  const width = 132;
  const height = 34;
  const peak = Math.max(1, ...values);

  const x = (index: number) =>
    2 + (index * (width - 4)) / Math.max(1, values.length - 1);

  const y = (value: number) => height - 3 - (value / peak) * (height - 6);
  const last = values.length - 1;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
    >
      <path
        d={values
          .map(
            (value, index) =>
              `${index === 0 ? "M" : "L"}${x(index)} ${y(value)}`
          )
          .join(" ")}
        fill="none"
        stroke="#b5bcc7"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx={x(last)}
        cy={y(values[last] ?? 0)}
        r="3.5"
        fill="#1a1b1e"
        stroke="#fff"
        strokeWidth="2"
      />
    </svg>
  );
};

interface Kpi {
  label: string;
  value: number | null;
  delta: string;
  /** True when the change is good news, false when bad, null when neutral. */
  good: boolean | null;
  trend?: readonly number[];
}

const deltaTone = (good: boolean | null) => {
  if (good === null) {
    return "text-text-tertiary";
  }

  return good ? "text-funded" : "text-over";
};

const DeltaIcon = ({ good }: { good: boolean | null }) => {
  if (good === null) {
    return null;
  }

  return good ? (
    <ArrowDownRight className="size-[13px]" aria-hidden />
  ) : (
    <ArrowUpRight className="size-[13px]" aria-hidden />
  );
};

export const KpiStrip = ({ kpis }: { kpis: readonly Kpi[] }) => (
  <dl className="-ml-7 flex">
    {kpis.map((kpi) => (
      <div
        key={kpi.label}
        className={cn(
          "border-border-subtle flex items-end justify-between border-l px-7 py-1",
          kpi.trend ? "flex-[1.3]" : "flex-1"
        )}
      >
        <div className="flex flex-col gap-1">
          <dt className="text-text-tertiary text-[13px] font-medium">
            {kpi.label}
          </dt>
          <dd
            className={cn(
              "text-[30px] leading-9 font-semibold tracking-tight",
              kpi.value === null && "text-text-disabled"
            )}
          >
            {kpi.value === null ? "—" : <Money cents={kpi.value} />}
          </dd>
          <dd
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              deltaTone(kpi.good)
            )}
          >
            <DeltaIcon good={kpi.good} />
            {kpi.delta}
          </dd>
        </div>
        {kpi.trend ? <Sparkline values={kpi.trend} /> : null}
      </div>
    ))}
  </dl>
);

const seq = ["bg-seq-0", "bg-seq-1", "bg-seq-2", "bg-seq-3", "bg-seq-4"];

export const Heatmap = ({
  days,
  weekendRatio,
}: {
  days: readonly SpendingDay[];
  weekendRatio: number | null;
}) => {
  const first = days[0]
    ? (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;

  const cells: (SpendingDay | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...days,
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <>
      <div className="text-text-tertiary grid grid-cols-7 gap-1 text-center text-[11px] font-medium">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="-mt-2 grid grid-cols-7 gap-1">
        {cells.map((cell, index) =>
          cell ? (
            <div
              key={cell.date}
              title={`${cell.date}: ${(cell.spent / 100).toFixed(2)}€`}
              className={cn(
                "flex h-[46px] flex-col justify-between rounded-md px-[7px] py-[5px] text-[11px] font-medium",
                seq[cell.level],
                cell.level >= 4 ? "text-white" : "text-text-secondary"
              )}
            >
              {Number(cell.date.slice(8))}
              {cell.level >= 4 ? (
                <Money
                  cents={Math.round(cell.spent / 100) * 100}
                  className="self-end font-semibold"
                />
              ) : null}
            </div>
          ) : (
            <div key={`blank-${index}`} className="h-[46px]" />
          )
        )}
      </div>
      <div className="text-text-tertiary flex items-center justify-between text-xs font-medium">
        <span className="flex items-center gap-2">
          Less
          {seq.map((tone) => (
            <span key={tone} className={cn("size-3.5 rounded-[3px]", tone)} />
          ))}
          More
        </span>
        {weekendRatio === null ? null : (
          <span>
            Weekends cost{" "}
            <span className="text-text-primary font-semibold">
              {weekendRatio.toFixed(1)}×
            </span>{" "}
            weekdays
          </span>
        )}
      </div>
    </>
  );
};

const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_120px_80px_460px_220px] items-center gap-x-7";

/** Groups against their usual range; a group opens to show its categories. */
export const GroupRanges = ({
  report,
  colors,
}: {
  report: SpendingReport;
  colors: Map<string, string>;
}) => {
  const [open, setOpen] = useState<string | null>(null);

  const row = (
    item: GroupSpending | SpendingReport["categories"][number],
    depth: 0 | 1,
    count?: number
  ) => {
    const above = item.unusual?.direction === "above";

    return (
      <div
        className={cn(
          COLUMNS,
          "px-3 font-medium",
          depth === 0
            ? "h-[52px] text-sm"
            : "text-text-secondary h-9 pl-[52px] text-[13px]",
          above && depth === 0 && "bg-surface-app rounded-[10px]"
        )}
      >
        <span className="flex items-center gap-3">
          {depth === 0 ? (
            <>
              {open === item.id ? (
                <ChevronDown
                  className="text-text-tertiary size-3.5"
                  aria-hidden
                />
              ) : (
                <ChevronRight
                  className="text-text-tertiary size-3.5"
                  aria-hidden
                />
              )}
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{
                  background: colors.get(item.id) ?? "var(--chart-other)",
                }}
              />
            </>
          ) : null}
          {item.name}
          {count === undefined ? null : (
            <span className="text-text-tertiary text-[13px]">
              {count} {count === 1 ? "category" : "categories"}
            </span>
          )}
        </span>
        <Money
          cents={item.spent}
          className={cn("text-right", depth === 0 && "font-semibold")}
        />
        <span className="tabular text-text-tertiary text-right text-[13px]">
          {percent.format(item.share)}
        </span>
        {item.usual ? (
          <UsualRange
            value={item.spent}
            low={item.usual.low}
            high={item.usual.high}
            average={item.usual.average}
          />
        ) : (
          <span className="text-text-tertiary text-[13px]">
            Not enough history
          </span>
        )}
        {above && item.unusual ? (
          <span className="text-over flex items-center gap-1 text-[13px]">
            <CircleAlert className="size-3.5" aria-hidden />
            {percent.format(item.unusual.change)} above usual
          </span>
        ) : (
          <span className="tabular text-text-tertiary text-[13px]">
            {item.usual
              ? `Usual ${Math.round(item.usual.low / 100)}–${Math.round(item.usual.high / 100)}€`
              : ""}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          COLUMNS,
          "text-text-tertiary h-7 px-3 text-xs font-medium"
        )}
      >
        <span>Group</span>
        <span className="text-right">Spent</span>
        <span className="text-right">Share</span>
        <span>Compared to usual</span>
        <span />
      </div>
      {report.groups.map((group) => (
        <div key={group.id}>
          <button
            type="button"
            className="w-full text-left"
            aria-expanded={open === group.id}
            onClick={() =>
              setOpen((current) => (current === group.id ? null : group.id))
            }
          >
            {row(group, 0, group.categoryCount)}
          </button>
          {open === group.id
            ? report.categories
                .filter((category) => category.groupId === group.id)
                .map((category) => (
                  <div key={category.id}>{row(category, 1)}</div>
                ))
            : null}
        </div>
      ))}
    </div>
  );
};
