import { createFileRoute } from "@tanstack/react-router";
import { spendingReport } from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import { UsualRange } from "@ynabe/ui/components/usual-range";
import { CircleAlert } from "lucide-react";
import { useMemo } from "react";

import { PaceChart } from "../components/pace-chart";
import { currentMonth, monthTitle, useBudget } from "../data/use-budget";

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  style: "percent",
});

const ReflectScreen = () => {
  const month = currentMonth();
  const { data } = useBudget();
  const report = useMemo(() => spendingReport(data, month), [data, month]);
  let headline = `Nothing to compare yet for ${monthTitle(month)}.`;

  if (report.change !== null) {
    headline = `${monthTitle(month).split(" ")[0]} was ${percent.format(Math.abs(report.change))} ${report.change < 0 ? "lighter" : "heavier"} than last month.`;
  }

  return (
    <div className="bg-surface-app flex flex-col gap-7 px-10 py-9">
      <h1 className="text-[32px] leading-[38px] font-semibold tracking-tight">
        {headline}
      </h1>
      <dl className="flex gap-10">
        <div>
          <dt className="text-text-tertiary text-[13px] font-medium">Spent</dt>
          <dd className="text-[30px] font-semibold tracking-tight">
            <Money cents={report.spent} />
          </dd>
        </div>
        <div>
          <dt className="text-text-tertiary text-[13px] font-medium">
            Daily average
          </dt>
          <dd className="text-[30px] font-semibold tracking-tight">
            <Money cents={report.dailyAverage} />
          </dd>
        </div>
      </dl>
      <section className="shadow-card rounded-[14px] bg-white p-6">
        <h2 className="text-[15px] font-semibold">Spending pace</h2>
        <p className="text-text-tertiary mb-4 text-[13px] font-medium">
          Cumulative spending through the month, against a typical month
        </p>
        <PaceChart pace={report.pace} />
      </section>
      <section className="shadow-card rounded-[14px] bg-white p-6">
        <h2 className="text-[15px] font-semibold">By category</h2>
        <p className="text-text-tertiary mb-4 text-[13px] font-medium">
          This month against each category’s last 6 months
        </p>
        {report.categories.map((category) => (
          <div
            key={category.id}
            className="grid h-[52px] grid-cols-[minmax(0,1fr)_120px_80px_460px_220px] items-center gap-x-7 px-3 text-sm font-medium"
          >
            <span>{category.name}</span>
            <Money
              cents={category.spent}
              className="text-right font-semibold"
            />
            <span className="tabular text-text-tertiary text-right text-[13px]">
              {percent.format(category.share)}
            </span>
            {category.usual ? (
              <UsualRange
                value={category.spent}
                low={category.usual.low}
                high={category.usual.high}
                average={category.usual.average}
              />
            ) : (
              <span />
            )}
            {category.unusual?.direction === "above" ? (
              <span className="text-over flex items-center gap-1 text-[13px]">
                <CircleAlert className="size-3.5" />
                {percent.format(category.unusual.change)} above usual
              </span>
            ) : (
              <span className="text-text-tertiary text-[13px]">
                Within usual
              </span>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};

export const Route = createFileRoute("/reflect")({ component: ReflectScreen });
