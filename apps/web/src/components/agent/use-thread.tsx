import { useRouterState } from "@tanstack/react-router";
import { planMonth } from "@ynabe/budget";
import { spendingReport } from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import {
  CalendarDays,
  CircleAlert,
  Repeat,
  Sparkles,
  Tag,
  Target,
  Zap,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";

import { loadThread, send, useThreadState } from "../../data/thread";
import {
  monthFromSearch,
  monthName,
  previousMonth,
  useBudget,
} from "../../data/use-budget";
import type { Suggestion } from "./parts";

const euros = (cents: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(cents / 100)}€`;

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  style: "percent",
});

const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Morning, Marco.";
  }

  return hour < 18 ? "Afternoon, Marco." : "Evening, Marco.";
};

/** A suggestion before it is tied to the screen: what to ask for. */
interface Idea extends Omit<Suggestion, "run"> {
  ask: string;
}

interface ScreenContext {
  month: string;
  plan: ReturnType<typeof planMonth>;
  report: ReturnType<typeof spendingReport>;
  ledger: ReturnType<typeof useBudget>["ledger"];
}

interface ScreenThread {
  /** The name of the screen, as the assistant hears it. */
  screen: string;
  /** What the app itself can say about the screen, without the model. */
  insight: ReactNode;
  ideas: Idea[];
}

const accountsThread = ({ ledger }: ScreenContext): ScreenThread => {
  const uncategorized = ledger.filter(
    (row) => row.categoryId === null && row.transferAccountId === null
  );

  const uncleared = ledger.filter((row) => row.cleared === "uncleared");

  return {
    ideas: [
      ...(uncategorized.length > 0
        ? [
            {
              ask: "Categorize the transactions that still need a category.",
              icon: Tag,
              label: `Categorize the ${uncategorized.length} new ones`,
            },
          ]
        : []),
      {
        ask: "Find my subscriptions: the payees that charge me regularly, and what they cost a month.",
        icon: Repeat,
        label: "Find subscriptions",
      },
    ],
    insight: (
      <>
        {uncategorized.length === 0
          ? "Every transaction has a category"
          : `${uncategorized.length} ${uncategorized.length === 1 ? "transaction needs" : "transactions need"} a category`}
        {uncleared.length > 0
          ? `, and ${uncleared.length} are still uncleared.`
          : "."}
      </>
    ),
    screen: "Accounts",
  };
};

const reflectThread = ({ month, report }: ScreenContext): ScreenThread => {
  const outlier = report.categories.find(
    (category) => category.unusual?.direction === "above"
  );

  return {
    ideas: outlier
      ? [
          {
            ask: `Set a realistic target for ${outlier.name}, from what I usually spend there.`,
            icon: Target,
            label: `Set a realistic target for ${outlier.name}`,
          },
        ]
      : [],
    insight:
      report.spent === 0 ? (
        "There’s no spending this month yet, so there’s nothing to compare."
      ) : (
        <>
          {monthName(month)} came in{" "}
          {report.change === null
            ? "with nothing to compare against"
            : `${percent.format(Math.abs(report.change))} ${report.change < 0 ? "under" : "over"} ${monthName(previousMonth(month))}`}
          .
          {outlier?.unusual
            ? ` ${outlier.name} is the outlier: ${euros(outlier.spent)}, ${percent.format(outlier.unusual.change)} above its usual.`
            : " Every category stayed within its usual range."}
        </>
      ),
    screen: "Reflect",
  };
};

const planInsight = (plan: ScreenContext["plan"], month: string): ReactNode => {
  const underfunded = plan.categories.filter(
    (category) => category.status === "underfunded"
  );

  const worst = plan.categories.find(
    (category) => category.status === "overspent"
  );

  if (plan.readyToAssign < 0) {
    return `Heads up: you’ve assigned ${euros(-plan.readyToAssign)} more than you have.`;
  }

  return (
    <>
      {greeting()} <Money cents={plan.readyToAssign} /> is ready to assign.
      {underfunded.length > 0 ? (
        <>
          {" "}
          {underfunded.length}{" "}
          {underfunded.length === 1
            ? "category still needs"
            : "categories still need"}{" "}
          <Money cents={plan.attention.needed} /> for {monthName(month)}
        </>
      ) : (
        " Every target is funded"
      )}
      {worst ? (
        <>
          , and {worst.name} is <Money cents={-worst.available} /> over.
        </>
      ) : (
        "."
      )}
    </>
  );
};

const planThread = ({ month, plan }: ScreenContext): ScreenThread => {
  const underfunded = plan.categories.filter(
    (category) => category.status === "underfunded"
  );

  const worst = plan.categories.find(
    (category) => category.status === "overspent"
  );

  return {
    ideas: [
      ...(underfunded.length > 0 && plan.readyToAssign > 0
        ? [
            {
              ask: `Fund the categories that still need money for ${monthName(month)}, from Ready to Assign.`,
              icon: Zap,
              label: `Fund ${underfunded.length} ${underfunded.length === 1 ? "category" : "categories"}`,
            },
          ]
        : []),
      ...(worst && plan.readyToAssign > 0
        ? [
            {
              ask: `Cover the overspending in ${worst.name}.`,
              icon: CircleAlert,
              label: `Cover ${worst.name}`,
            },
          ]
        : []),
      {
        ask: `Where did ${monthName(month)} go?`,
        icon: CalendarDays,
        label: `Where did ${monthName(month)} go?`,
      },
    ],
    insight: planInsight(plan, month),
    screen: "Plan",
  };
};

const fallback: Idea = {
  ask: "What can you do?",
  icon: Sparkles,
  label: "What can you do?",
};

/** The conversation with the assistant, and what it offers on this screen. */
export const useThread = () => {
  const { pathname, search } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      search: state.location.search,
    }),
  });

  const month = monthFromSearch(search);
  const { data, ledger, groups } = useBudget();
  const thread = useThreadState();

  useEffect(() => {
    loadThread().catch(() => null);
  }, []);

  const plan = useMemo(() => planMonth(data, month), [data, month]);

  const report = useMemo(
    () => spendingReport({ ...data, groups }, month),
    [data, groups, month]
  );

  const context: ScreenContext = { ledger, month, plan, report };
  const page = pathname.split("/")[1] ?? "plan";

  let screenThread = planThread(context);

  if (page === "accounts") {
    screenThread = accountsThread(context);
  } else if (page === "reflect") {
    screenThread = reflectThread(context);
  }

  const { screen } = screenThread;
  const ask = (text: string) => send({ month, screen, text });
  const ideas = screenThread.ideas.length > 0 ? screenThread.ideas : [fallback];

  return {
    ...thread,
    context: `${screen} · ${monthName(month)}`,
    insight: screenThread.insight,
    send: ask,
    suggestions: ideas.map(({ ask: text, ...idea }): Suggestion => ({
      ...idea,
      run: () => {
        void ask(text);
      },
    })),
  };
};
