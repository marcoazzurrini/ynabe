import { useRouterState } from "@tanstack/react-router";
import { planMonth } from "@ynabe/budget";
import { spendingReport } from "@ynabe/reports";
import { Money } from "@ynabe/ui/components/money";
import {
  Brain,
  CalendarDays,
  ChartPie,
  CircleAlert,
  CircleDashed,
  History,
  Repeat,
  Search,
  Sparkles,
  Tag,
  Target,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import { setAssigned, setCategory, updateTarget } from "../../data/actions";
import {
  monthFromSearch,
  monthName,
  previousMonth,
  useBudget,
} from "../../data/use-budget";
import { CategoryIcon } from "../category-icon";
import type { ProposalLine, Step, Suggestion } from "./parts";

const euros = (cents: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(cents / 100)}€`;

const percent = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
  style: "percent",
});

export interface ProposalSpec {
  title: string;
  lines: ProposalLine[];
  footnote: string;
  appliedLabel: string;
  apply: () => void;
}

export interface Exchange {
  id: number;
  user: string;
  steps: Step[];
  reply: ReactNode;
  proposal?: ProposalSpec;
}

const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Morning, Marco.";
  }

  return hour < 18 ? "Afternoon, Marco." : "Evening, Marco.";
};

const NOT_CONNECTED =
  "I can’t answer free-form questions yet, because the model isn’t connected. Try one of the suggestions.";

interface ThreadContext {
  month: string;
  add: (exchange: Omit<Exchange, "id">) => void;
  iconOf: (categoryId: string) => string | null;
  plan: ReturnType<typeof planMonth>;
  report: ReturnType<typeof spendingReport>;
  ledger: ReturnType<typeof useBudget>["ledger"];
  categories: ReturnType<typeof useBudget>["categories"];
}

interface ScreenThread {
  context: string;
  insight: ReactNode;
  suggestions: Suggestion[];
}

const accountsThread = ({
  add,
  categories,
  iconOf,
  ledger,
  report,
}: ThreadContext): ScreenThread => {
  let insight: ReactNode = null;
  let suggestions: Suggestion[] = [];
  let context = "";

  context = "Accounts";

  const uncategorized = ledger.filter(
    (row) => row.categoryId === null && row.transferAccountId === null
  );

  const uncleared = ledger.filter((row) => row.cleared === "uncleared");

  const guess = (payee: string, id: string) => {
    const counts = new Map<string, number>();

    for (const row of ledger) {
      if (
        row.payee === payee &&
        row.id !== id &&
        row.categoryId &&
        row.categoryId !== "ready-to-assign"
      ) {
        counts.set(row.categoryId, (counts.get(row.categoryId) ?? 0) + 1);
      }
    }

    return [...counts].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  insight = (
    <>
      {uncategorized.length === 0
        ? "Every transaction has a category."
        : `${uncategorized.length} ${uncategorized.length === 1 ? "transaction needs" : "transactions need"} a category`}
      {uncleared.length > 0
        ? `, and ${uncleared.length} are still uncleared.`
        : "."}
    </>
  );
  suggestions = [
    ...(uncategorized.length > 0
      ? [
          {
            icon: Tag,
            label: `Categorize the ${uncategorized.length} new ones`,
            run: () => {
              const guesses = uncategorized.map((row) => ({
                guess: guess(row.payee, row.id),
                row,
              }));

              const known = guesses.filter(
                ({ guess: found }) => found !== null
              );

              add({
                proposal:
                  known.length === 0
                    ? undefined
                    : {
                        apply: () => {
                          for (const { row, guess: found } of known) {
                            setCategory(row.id, found);
                          }
                        },
                        appliedLabel: `Applied · ${known.length} categorized`,
                        footnote: "From how you filed the same payees before",
                        lines: guesses.map(({ row, guess: found }) => ({
                          icon: (
                            <CategoryIcon name={found ? iconOf(found) : null} />
                          ),
                          label: `${row.payee} · ${euros(-row.amount)}`,
                          value:
                            categories.find((category) => category.id === found)
                              ?.name ?? "No guess yet",
                        })),
                        title: `Categorize ${known.length} ${known.length === 1 ? "transaction" : "transactions"}`,
                      },
                reply:
                  known.length === 0
                    ? "I haven’t seen these payees before, so pick their categories in the list."
                    : "Based on how you usually file these:",
                steps: [
                  { icon: Brain, label: "Thought for 1s" },
                  {
                    icon: History,
                    label: `Looked at ${ledger.length} past transactions`,
                  },
                ],
                user: "Categorize the new ones.",
              });
            },
          },
        ]
      : []),
    {
      icon: Repeat,
      label: "Find subscriptions",
      run: () => {
        const subscriptions = report.groups.find(
          (group) => group.name === "Subscriptions"
        );

        add({
          reply: subscriptions ? (
            <>
              Subscriptions cost <Money cents={subscriptions.spent} /> this
              month, across {subscriptions.categoryCount} services.
            </>
          ) : (
            "I didn’t find a Subscriptions group."
          ),
          steps: [{ icon: Search, label: "Grouped repeating payees" }],
          user: "Find my subscriptions.",
        });
      },
    },
  ];

  return { context, insight, suggestions };
};

const reflectThread = ({
  add,
  categories,
  month,
  report,
}: ThreadContext): ScreenThread => {
  let insight: ReactNode = null;
  let suggestions: Suggestion[] = [];
  let context = "";

  context = `Reflect · ${monthName(month)}`;

  const outlier = report.categories.find(
    (category) => category.unusual?.direction === "above"
  );

  const outlierCategory = categories.find(
    (category) => category.id === outlier?.id
  );

  insight =
    report.spent === 0 ? (
      "There’s no spending this month yet, so there’s nothing to compare. Once your transactions are in, I’ll tell you what changed."
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
    );
  suggestions =
    outlier?.usual && outlierCategory
      ? [
          {
            icon: Target,
            label: `Set a realistic target for ${outlier.name}`,
            run: () => {
              const usual = outlier.usual?.high ?? 0;
              const amount = Math.ceil(usual / 1000) * 1000;
              const current = outlierCategory.target?.amount ?? 0;

              add({
                proposal: {
                  apply: () =>
                    updateTarget(outlierCategory.id, {
                      amount,
                      kind: "monthly",
                    }),
                  appliedLabel: `Applied · ${outlier.name} target is ${euros(amount)}`,
                  footnote: "Covers every recent month",
                  lines: [
                    {
                      icon: (
                        <Target className="text-text-tertiary size-[15px]" />
                      ),
                      label: "Monthly target",
                      value: `${current === 0 ? "None" : euros(current)} → ${euros(amount)}`,
                    },
                  ],
                  title: `Set ${outlier.name} target to ${euros(amount)}`,
                },
                reply: `You usually spend up to ${euros(usual)} on ${outlier.name}. A ${euros(amount)} target would have covered every recent month.`,
                steps: [
                  { icon: Brain, label: "Thought for 2s" },
                  {
                    icon: ChartPie,
                    label: `Compared ${outlier.name} with its last 6 months`,
                  },
                ],
                user: `Set a realistic target for ${outlier.name}.`,
              });
            },
          },
        ]
      : [];

  return { context, insight, suggestions };
};

const planInsight = (plan: ThreadContext["plan"], month: string): ReactNode => {
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

const planThread = ({
  add,
  iconOf,
  month,
  plan,
  report,
}: ThreadContext): ScreenThread => {
  let suggestions: Suggestion[] = [];

  const underfunded = plan.categories.filter(
    (category) => category.status === "underfunded"
  );

  const worst = plan.categories.find(
    (category) => category.status === "overspent"
  );

  suggestions = [
    ...(underfunded.length > 0 && plan.readyToAssign > 0
      ? [
          {
            icon: Zap,
            label: `Fund ${underfunded.length} ${underfunded.length === 1 ? "category" : "categories"}`,
            run: () => {
              let left = plan.readyToAssign;

              const funded = underfunded
                .map((category) => {
                  const amount = Math.min(category.needed, left);

                  left -= amount;

                  return { amount, category };
                })
                .filter(({ amount }) => amount > 0);

              const total = funded.reduce((sum, { amount }) => sum + amount, 0);

              const shown = funded.slice(0, 4);
              const rest = funded.slice(4);

              add({
                proposal: {
                  apply: () => {
                    for (const { category, amount } of funded) {
                      setAssigned(
                        category.id,
                        month,
                        category.assigned + amount
                      );
                    }
                  },
                  appliedLabel: `Applied · ${funded.length} categories funded`,
                  footnote: `Leaves ${euros(plan.readyToAssign - total)} ready to assign`,
                  lines: [
                    ...shown.map(({ category, amount }) => ({
                      icon: <CategoryIcon name={iconOf(category.id)} />,
                      label: category.name,
                      positive: true,
                      value: `+${euros(amount)}`,
                    })),
                    ...(rest.length > 0
                      ? [
                          {
                            icon: null,
                            label: `${rest.length} more ${rest.length === 1 ? "category" : "categories"}`,
                            value: `+${euros(rest.reduce((sum, { amount }) => sum + amount, 0))}`,
                          },
                        ]
                      : []),
                  ],
                  title: `Assign ${euros(total)} across ${funded.length} ${funded.length === 1 ? "category" : "categories"}`,
                },
                reply:
                  total < plan.attention.needed
                    ? `You have ${euros(plan.readyToAssign)}, so this funds the first targets in your list and stops there.`
                    : `This funds every target and leaves ${euros(plan.readyToAssign - total)} unassigned.`,
                steps: [
                  { icon: Brain, label: "Thought for 2s" },
                  {
                    icon: Search,
                    label: `Checked ${underfunded.length} underfunded targets`,
                  },
                ],
                user: "Fund the categories that need money.",
              });
            },
          },
        ]
      : []),
    ...(worst && plan.readyToAssign > 0
      ? [
          {
            icon: CircleAlert,
            label: `Cover ${worst.name}`,
            run: () => {
              const amount = Math.min(-worst.available, plan.readyToAssign);

              add({
                proposal: {
                  apply: () =>
                    setAssigned(worst.id, month, worst.assigned + amount),
                  appliedLabel: `Applied · ${worst.name} is back to zero`,
                  footnote: "Comes out of Ready to Assign",
                  lines: [
                    {
                      icon: <CategoryIcon name={iconOf(worst.id)} />,
                      label: worst.name,
                      positive: true,
                      value: `+${euros(amount)}`,
                    },
                  ],
                  title: `Cover ${worst.name} with ${euros(amount)}`,
                },
                reply: `${worst.name} spent ${euros(-worst.activity)} against ${euros(worst.assigned)} assigned. Moving ${euros(amount)} from Ready to Assign brings it back to zero.`,
                steps: [
                  {
                    icon: Search,
                    label: `Read ${worst.name} for ${monthName(month)}`,
                  },
                ],
                user: `Cover ${worst.name}.`,
              });
            },
          },
        ]
      : []),
    {
      icon: CalendarDays,
      label: `Where did ${monthName(month)} go?`,
      run: () => {
        const top = report.groups.slice(0, 3);

        add({
          reply:
            top.length === 0
              ? "Nothing has been spent yet this month."
              : `You spent ${euros(report.spent)}. Most went to ${top.map((group) => `${group.name} (${euros(group.spent)})`).join(", ")}.`,
          steps: [{ icon: ChartPie, label: "Added up spending by group" }],
          user: `Where did ${monthName(month)} go?`,
        });
      },
    },
  ];

  return {
    context: `Plan · ${monthName(month)}`,
    insight: planInsight(plan, month),
    suggestions,
  };
};

/** What the assistant says and offers on the current screen. */
export const useThread = () => {
  const { pathname, search } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      search: state.location.search,
    }),
  });

  const month = monthFromSearch(search);
  const screen = pathname.split("/")[1] ?? "plan";
  const { data, ledger, categories, groups } = useBudget();
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [applied, setApplied] = useState<number[]>([]);
  const [scope, setScope] = useState(`${screen}:${month}`);

  // A new screen or month starts a fresh thread.
  if (scope !== `${screen}:${month}`) {
    setScope(`${screen}:${month}`);
    setExchanges([]);
    setApplied([]);
  }

  const plan = useMemo(() => planMonth(data, month), [data, month]);

  const report = useMemo(
    () => spendingReport({ ...data, groups }, month),
    [data, groups, month]
  );

  const add = (exchange: Omit<Exchange, "id">) =>
    setExchanges((current) => [
      ...current,
      { ...exchange, id: current.length + 1 },
    ]);

  const iconOf = (categoryId: string) =>
    categories.find((category) => category.id === categoryId)?.icon ?? null;

  const threadContext: ThreadContext = {
    add,
    categories,
    iconOf,
    ledger,
    month,
    plan,
    report,
  };

  let screenThread = planThread(threadContext);

  if (screen === "accounts") {
    screenThread = accountsThread(threadContext);
  } else if (screen === "reflect") {
    screenThread = reflectThread(threadContext);
  }

  const fallback: Suggestion = {
    icon: Sparkles,
    label: "What can you do?",
    run: () =>
      add({
        reply:
          "I can fund targets, cover overspending, categorize transactions, and explain your spending. Each change shows up as a proposal first.",
        steps: [],
        user: "What can you do?",
      }),
  };

  return {
    applied,
    context: screenThread.context,
    exchanges,
    insight: screenThread.insight,
    markApplied: (id: number) => setApplied((current) => [...current, id]),
    send: (text: string) =>
      add({
        reply: NOT_CONNECTED,
        steps: [{ icon: CircleDashed, label: "Model not connected" }],
        user: text,
      }),
    suggestions:
      screenThread.suggestions.length > 0
        ? screenThread.suggestions
        : [fallback],
  };
};
