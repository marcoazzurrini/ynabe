import { areaY, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { PacePoint } from "@ynabe/reports";
import { useMemo } from "react";

const euros = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Cumulative spending through the month against a typical month. */
export const PaceChart = ({ pace }: { pace: readonly PacePoint[] }) => {
  const definition = useMemo(() => {
    const rows = pace.map((point) => ({
      actual: point.actual / 100,
      day: point.day,
      high: point.high / 100,
      low: point.low / 100,
      typical: point.typical / 100,
    }));

    return defineChart({
      marks: [
        areaY(rows, {
          fill: "var(--chart-muted, #8e96a4)",
          fillOpacity: 0.12,
          x: "day",
          y1: "low",
          y2: "high",
        }),
        lineY(rows, {
          stroke: "var(--gray-400)",
          strokeWidth: 2,
          x: "day",
          y: "typical",
        }),
        lineY(rows, {
          stroke: "var(--text-primary)",
          strokeWidth: 2,
          x: "day",
          y: "actual",
        }),
      ],
      scales: {
        x: { axis: { label: "Day of the month" }, scale: scaleLinear },
        y: {
          axis: { ticks: { format: (value) => `${euros.format(value)}€` } },
          grid: true,
          nice: true,
          scale: scaleLinear,
        },
      },
      tooltip,
    });
  }, [pace]);

  return (
    <Chart
      definition={definition}
      height={300}
      ariaLabel="Spending pace"
      ariaDescription="Cumulative spending this month, a typical month, and the usual range."
    />
  );
};
