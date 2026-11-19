import type { Cents, Month } from "@ynabe/budget";

/** The parts of a spending report the headline reads. */
interface HeadlineInput {
  month: Month;
  spent: Cents;
  /** Change against the previous month, as a ratio: -0.062 is 6.2% less. */
  change: number | null;
  groups: readonly {
    name: string;
    unusual: { direction: "above" | "below"; change: number } | null;
  }[];
}

const monthName = (month: Month) =>
  new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

const before = (month: Month) => {
  const date = new Date(`${month}-01T12:00:00Z`);

  date.setUTCMonth(date.getUTCMonth() - 1);

  return date.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
};

/** A month's spending in a sentence, and what stands out, if anything. */
export interface Headline {
  lead: string;
  aside: string | null;
}

/** `6.2%`, without a sign. */
export const percent = (ratio: number): string =>
  `${(Math.abs(ratio) * 100).toFixed(1)}%`;

/**
 * A month's spending in one sentence, and the group that stands out
 * most above its usual range, if any: `October was 6.2% lighter than
 * September.` and `Entertainment is the exception.`
 */
export const spendingHeadline = (report: HeadlineInput): Headline => {
  const name = monthName(report.month);

  const [outlier] = report.groups
    .filter((group) => group.unusual?.direction === "above")
    .toSorted((a, b) => (b.unusual?.change ?? 0) - (a.unusual?.change ?? 0));

  if (report.spent === 0) {
    return { aside: null, lead: `Nothing spent in ${name} yet.` };
  }

  if (report.change === null) {
    return {
      aside: outlier ? `${outlier.name} is above its usual.` : null,
      lead: `${name} is the first month with spending.`,
    };
  }

  const lighter = report.change < 0;

  let aside: string | null = null;

  if (outlier) {
    aside = lighter
      ? `${outlier.name} is the exception.`
      : `${outlier.name} stands out most.`;
  }

  return {
    aside,
    lead:
      Math.abs(report.change) < 0.005
        ? `${name} matched ${before(report.month)}.`
        : `${name} was ${percent(report.change)} ${lighter ? "lighter" : "heavier"} than ${before(report.month)}.`,
  };
};
