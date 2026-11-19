import type {
  CalendarMonth,
  RangeMonth,
  RangeSlice,
  SpendingDay,
} from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import { cn } from "@ynabe/ui/lib/utils";
import type { ReactNode } from "react";

import { monthName, monthShort } from "../../data/use-budget";

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  style: "percent",
});

const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const compact = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  notation: "compact",
});

/** `2k`, for axis labels. */
const short = (euros: number) => compact.format(euros).toLowerCase();

export const Card = ({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      "shadow-card flex min-w-0 flex-col gap-5 rounded-[14px] bg-white p-6 max-md:rounded-2xl max-md:p-4",
      className
    )}
  >
    <header className="flex items-center justify-between gap-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {aside}
    </header>
    {children}
  </section>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-text-tertiary flex flex-1 items-center justify-center py-10 text-center text-[13px] font-medium">
    {children}
  </p>
);

/** Round axis values that cover `low` to `high` in about four steps. */
const axis = (low: number, high: number): number[] => {
  const span = Math.max(1, high - low);
  const rough = span / 4;
  const power = 10 ** Math.floor(Math.log10(rough));

  const step =
    [1, 2, 5, 10].map((factor) => factor * power).find((s) => s >= rough) ??
    power * 10;

  const first = Math.floor(low / step) * step;
  const final = Math.ceil(high / step) * step;

  return Array.from(
    { length: Math.round((final - first) / step) + 1 },
    (_, index) => first + index * step
  );
};

/** The plot area both charts share: gridlines with labels on the left. */
const Plot = ({
  ticks,
  children,
}: {
  ticks: readonly number[];
  children: ReactNode;
}) => {
  const low = ticks[0] ?? 0;
  const high = ticks.at(-1) ?? 1;

  return (
    <div className="relative h-[190px]">
      {ticks.map((tick, index) => (
        <div
          key={tick}
          className={cn(
            "absolute inset-x-0 border-t",
            index === 0 ? "border-gray-300" : "border-border-subtle"
          )}
          style={{ bottom: `${((tick - low) / (high - low)) * 100}%` }}
        >
          <span className="text-text-tertiary tabular absolute -left-11 w-9 -translate-y-1/2 text-right text-[11px]">
            {short(tick)}
          </span>
        </div>
      ))}
      {children}
    </div>
  );
};

/** Which labels to keep so that about 12 fit along the bottom. */
const every = (count: number) => Math.max(1, Math.ceil(count / 12));

export const MonthlySpending = ({
  months,
}: {
  months: readonly RangeMonth[];
}) => {
  const firstSpend = months.findIndex((month) => month.spent > 0);

  if (firstSpend === -1) {
    return <Empty>No spending in these months.</Empty>;
  }

  const counted = months.slice(firstSpend);

  const average =
    counted.reduce((total, month) => total + month.spent, 0) /
    counted.length /
    100;

  const ticks = axis(0, Math.max(...months.map((month) => month.spent)) / 100);
  const top = ticks.at(-1) ?? 1;
  const values = months.length <= 14;
  const skip = every(months.length);

  return (
    <div className="pl-11">
      <Plot ticks={ticks}>
        <div className="absolute inset-y-0 right-24 left-0 flex items-end">
          {months.map((month) => (
            <div
              key={month.month}
              title={`${monthName(month.month)}: ${whole.format(month.spent / 100)}€`}
              className="flex h-full flex-1 flex-col items-center justify-end"
            >
              {values && month.spent > 0 ? (
                <span
                  className={cn(
                    "tabular z-10 mb-1 rounded-sm bg-white px-0.5 text-[11px]",
                    month.inRange
                      ? "font-semibold"
                      : "text-text-tertiary font-medium"
                  )}
                >
                  {whole.format(month.spent / 100)}
                </span>
              ) : null}
              <span
                className={cn(
                  "w-[min(64px,70%)] rounded-t-[5px]",
                  month.inRange ? "bg-chart-1" : "bg-gray-350"
                )}
                style={{ height: `${(month.spent / 100 / top) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div
          className="border-text-primary absolute right-24 left-0 border-t border-dashed"
          style={{ bottom: `${(average / top) * 100}%` }}
        />
        <div
          className="absolute right-0 flex w-[88px] translate-y-1/2 flex-col text-[11px] leading-[14px]"
          style={{ bottom: `${(average / top) * 100}%` }}
        >
          <span className="text-text-tertiary">Average</span>
          <span className="tabular text-xs font-semibold">
            {whole.format(average)}€
          </span>
        </div>
      </Plot>
      <div className="mr-24 flex pt-2">
        {months.map((month, index) => (
          <span
            key={month.month}
            className={cn(
              "flex-1 text-center text-xs",
              month.inRange ? "font-semibold" : "text-text-tertiary"
            )}
          >
            {(months.length - 1 - index) % skip === 0
              ? monthShort(month.month)
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

export const NetWorth = ({ months }: { months: readonly RangeMonth[] }) => {
  const values = months.map((month) => month.netWorth / 100);
  const ticks = axis(Math.min(...values), Math.max(...values));
  const low = ticks[0] ?? 0;
  const high = ticks.at(-1) ?? 1;
  const last = months.length - 1;
  const skip = every(months.length);
  const x = (index: number) => (last === 0 ? 100 : (index / last) * 100);
  const y = (value: number) => ((value - low) / (high - low)) * 100;

  const line = values
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${x(index)} ${100 - y(value)}`
    )
    .join(" ");

  const final = values[last] ?? 0;

  return (
    <div className="pl-11">
      <Plot ticks={ticks}>
        <div className="absolute inset-y-0 right-24 left-0">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
            aria-hidden
          >
            <path
              d={`${line} L${x(last)} 100 L${x(0)} 100 Z`}
              fill="var(--chart-1)"
              opacity="0.08"
            />
            <path
              d={line}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            className="bg-chart-1 absolute size-[11px] translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
            style={{ bottom: `${y(final)}%`, right: 0 }}
          />
        </div>
        <span
          className="tabular absolute right-0 w-[84px] translate-y-1/2 text-xs font-semibold"
          style={{ bottom: `${y(final)}%` }}
        >
          {whole.format(final)}€
        </span>
      </Plot>
      <div className="relative mr-24 h-6">
        {months.map((month, index) =>
          (last - index) % skip === 0 ? (
            <span
              key={month.month}
              className={cn(
                "absolute top-2 -translate-x-1/2 text-xs",
                index === last ? "font-semibold" : "text-text-tertiary"
              )}
              style={{ left: `${x(index)}%` }}
            >
              {monthShort(month.month)}
            </span>
          ) : null
        )}
      </div>
    </div>
  );
};

const seq = ["bg-seq-0", "bg-seq-1", "bg-seq-2", "bg-seq-3", "bg-seq-4"];

const Calendar = ({
  month,
  current,
}: {
  month: CalendarMonth;
  current: boolean;
}) => {
  const first = month.days[0]
    ? (new Date(`${month.days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;

  const cells: (SpendingDay | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...month.days,
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div
        className={cn(
          "flex items-baseline justify-between text-[13px] font-semibold",
          !current && "text-text-secondary"
        )}
      >
        {monthName(month.month)}
        <Money
          cents={month.spent}
          className={cn(!current && "text-text-tertiary")}
        />
      </div>
      <div className="text-text-tertiary grid grid-cols-7 gap-1 text-center text-[11px] font-medium">
        {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- two days share a letter
          <span key={index}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, index) =>
          cell ? (
            <div
              key={cell.date}
              title={`${cell.date}: ${(cell.spent / 100).toFixed(2)}€`}
              className={cn(
                "flex h-10 flex-col justify-between rounded-md px-1.5 py-1 text-[11px] font-medium",
                seq[cell.level],
                cell.level >= 4 ? "text-white" : "text-text-secondary"
              )}
            >
              {Number(cell.date.slice(8))}
              {cell.date === month.peak ? (
                <span
                  className={cn(
                    "tabular self-end leading-3 font-semibold",
                    cell.level < 4 && "text-text-primary"
                  )}
                >
                  {whole.format(cell.spent / 100)}€
                </span>
              ) : null}
            </div>
          ) : (
            // oxlint-disable-next-line react/no-array-index-key -- blank cells have no identity
            <div key={`blank-${index}`} className="h-10" />
          )
        )}
      </div>
    </div>
  );
};

export const DailySpending = ({
  calendar,
}: {
  calendar: readonly CalendarMonth[];
}) => (
  <div className="flex gap-10 max-md:flex-col max-md:gap-6">
    {calendar.map((month, index) => (
      <Calendar
        key={month.month}
        month={month}
        current={index === calendar.length - 1}
      />
    ))}
  </div>
);

export const HeatmapKey = () => (
  <span className="text-text-tertiary flex items-center gap-2 text-xs font-medium">
    Less
    {seq.slice(1).map((tone) => (
      <span key={tone} className={cn("size-3.5 rounded-[3px]", tone)} />
    ))}
    More
  </span>
);

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

const RADIUS = 80;
const AROUND = 2 * Math.PI * RADIUS;

/** Where the money went: a donut with the total inside, and a legend. */
export const SpendingDonut = ({
  slices,
  spent,
}: {
  slices: readonly RangeSlice[];
  spent: number;
}) => {
  if (spent <= 0 || slices.length === 0) {
    return <Empty>No spending in this period.</Empty>;
  }

  const rest = slices.slice(PALETTE.length);

  const shown = [
    ...slices.slice(0, PALETTE.length).map((slice, index) => ({
      ...slice,
      color: PALETTE[index] ?? "var(--chart-other)",
    })),
    ...(rest.length === 0
      ? []
      : [
          {
            color: "var(--chart-other)",
            id: "other",
            name: "Other",
            share: rest.reduce((total, slice) => total + slice.share, 0),
            spent: rest.reduce((total, slice) => total + slice.spent, 0),
          },
        ]),
  ];

  const arcs: { id: string; color: string; length: number; offset: number }[] =
    [];

  let offset = 0;

  for (const slice of shown) {
    const length = Math.max(0, slice.share) * AROUND;

    arcs.push({ color: slice.color, id: slice.id, length, offset });
    offset += length;
  }

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg
        width="240"
        height="240"
        viewBox="0 0 240 240"
        className="shrink-0"
        aria-hidden
      >
        <g transform="rotate(-90 120 120)">
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx="120"
              cy="120"
              r={RADIUS}
              fill="none"
              stroke={arc.color}
              strokeWidth="36"
              strokeDasharray={`${Math.max(0, arc.length - 2)} ${AROUND}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </g>
        <text
          x="120"
          y="116"
          textAnchor="middle"
          className="fill-text-primary tabular text-[22px] font-semibold"
        >
          {whole.format(spent / 100)}€
        </text>
        <text
          x="120"
          y="136"
          textAnchor="middle"
          className="fill-text-tertiary text-xs"
        >
          spent
        </text>
      </svg>
      <ul className="flex min-w-[260px] flex-1 flex-col">
        {shown.map((slice) => (
          <li
            key={slice.id}
            className="border-border-subtle grid h-10 grid-cols-[14px_minmax(0,1fr)_100px_48px] items-center gap-x-3 border-t text-sm font-medium"
          >
            <span
              className="size-2.5 rounded-[3px]"
              style={{ background: slice.color }}
            />
            <span className="truncate">{slice.name}</span>
            <Money cents={slice.spent} className="text-right font-semibold" />
            <span className="tabular text-text-tertiary text-right">
              {percent.format(slice.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
