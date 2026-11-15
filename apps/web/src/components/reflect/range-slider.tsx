import { cn } from "@ynabe/ui/lib/utils";
import { useRef } from "react";
import type { PointerEvent } from "react";

import { monthName, monthYear } from "../../data/use-budget";

interface RangeSliderProps {
  /** Every month the slider covers, oldest first. */
  history: readonly { month: string; spent: number }[];
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

type Mode = "start" | "end" | "move";

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const label = (month: string) => `${monthName(month)} ${monthYear(month)}`;

/**
 * A strip of months, one bar each, with a window over the chosen range.
 * Drag a handle to resize the window, or drag the window to move it.
 */
export const RangeSlider = ({
  history,
  from,
  to,
  onChange,
}: RangeSliderProps) => {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; grab: number } | null>(null);
  const last = history.length - 1;

  const start = clamp(
    history.findIndex((entry) => entry.month === from),
    0,
    last
  );

  const end = clamp(
    history.findIndex((entry) => entry.month === to),
    start,
    last
  );

  const peak = Math.max(1, ...history.map((entry) => entry.spent));

  const commit = (nextStart: number, nextEnd: number) => {
    const first = history[nextStart];
    const final = history[nextEnd];

    if (first && final && (nextStart !== start || nextEnd !== end)) {
      onChange(first.month, final.month);
    }
  };

  const indexAt = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();

    if (!box || box.width === 0) {
      return 0;
    }

    return clamp(
      Math.floor(((clientX - box.left) / box.width) * history.length),
      0,
      last
    );
  };

  const begin = (mode: Mode) => (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { grab: indexAt(event.clientX) - start, mode };
  };

  const jump = (event: PointerEvent<HTMLElement>) => {
    const length = end - start;
    const index = indexAt(event.clientX);

    const nextStart = clamp(index - Math.floor(length / 2), 0, last - length);

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { grab: index - nextStart, mode: "move" };
    commit(nextStart, nextStart + length);
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current) {
      return;
    }

    const index = indexAt(event.clientX);
    const { mode, grab } = drag.current;

    if (mode === "start") {
      commit(Math.min(index, end), end);
    } else if (mode === "end") {
      commit(start, Math.max(index, start));
    } else {
      const length = end - start;
      const nextStart = clamp(index - grab, 0, last - length);

      commit(nextStart, nextStart + length);
    }
  };

  const release = () => {
    drag.current = null;
  };

  const handle = (mode: "start" | "end") => {
    const index = mode === "start" ? start : end;
    const month = history[index]?.month ?? from;

    return (
      <span
        onPointerDown={begin(mode)}
        className={cn(
          "border-chart-1 absolute top-1/2 h-[22px] w-2.5 -translate-y-1/2 cursor-ew-resize touch-none rounded-[5px] border-[1.5px] bg-white shadow-xs",
          "has-focus-visible:ring-ring/50 has-focus-visible:ring-3",
          mode === "start" ? "-left-[6px]" : "-right-[6px]"
        )}
      >
        <input
          type="range"
          className="sr-only"
          aria-label={mode === "start" ? "First month" : "Last month"}
          aria-valuetext={label(month)}
          min={0}
          max={last}
          value={index}
          onChange={(event) => {
            const next = Number(event.target.value);

            if (mode === "start") {
              commit(Math.min(next, end), end);
            } else {
              commit(start, Math.max(next, start));
            }
          }}
        />
      </span>
    );
  };

  return (
    <div
      className="bg-surface-sunken h-10 min-w-[240px] flex-1 touch-none rounded-[10px] px-2 py-1.5 select-none"
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        ref={track}
        className="relative h-full cursor-pointer"
        onPointerDown={jump}
      >
        <div className="flex h-full items-end gap-[3px]" aria-hidden>
          {history.map((entry, index) => (
            <span
              key={entry.month}
              title={label(entry.month)}
              className={cn(
                "min-h-[3px] flex-1 rounded-[2px]",
                index >= start && index <= end ? "bg-chart-1" : "bg-gray-350"
              )}
              style={{ height: `${(entry.spent / peak) * 100}%` }}
            />
          ))}
        </div>
        {history.map((entry, index) =>
          entry.month.endsWith("-01") && index > 0 ? (
            <span
              key={entry.month}
              aria-hidden
              className="text-text-tertiary pointer-events-none absolute -top-[3px] bottom-0 border-l border-gray-400 pl-[3px] text-[10px] leading-3 font-semibold"
              style={{ left: `${(index / history.length) * 100}%` }}
            >
              {monthYear(entry.month)}
            </span>
          ) : null
        )}
        <div
          className="border-chart-1 absolute -top-1.5 -bottom-1.5 cursor-grab rounded-lg border-[1.5px] bg-[rgb(42_120_214/0.08)] active:cursor-grabbing"
          style={{
            left: `${(start / history.length) * 100}%`,
            width: `${((end - start + 1) / history.length) * 100}%`,
          }}
          onPointerDown={begin("move")}
        >
          {handle("start")}
          {handle("end")}
        </div>
      </div>
    </div>
  );
};
