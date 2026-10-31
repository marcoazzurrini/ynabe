import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  AssistantMessage,
  Proposal,
  Steps,
  Suggestions,
  UserMessage,
} from "@ynabe/web/components/agent/parts";
import {
  Brain,
  CalendarDays,
  CircleAlert,
  Search,
  Wrench,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { fn } from "storybook/test";

const Thread = () => {
  const [applied, setApplied] = useState(false);

  return (
    <div className="flex w-[568px] flex-col gap-5">
      <AssistantMessage>
        Morning, Marco. 421.76€ is ready to assign. 5 categories still need
        802.85€ for October, and Eating Out is 47.36€ over.
      </AssistantMessage>
      <UserMessage>Fund the categories that need money.</UserMessage>
      <Steps
        steps={[
          { icon: Brain, label: "Thought for 2s" },
          { icon: Search, label: "Checked 5 underfunded targets" },
        ]}
      />
      <AssistantMessage>
        You have 421.76€, so this funds the first targets in your list and stops
        there.
      </AssistantMessage>
      <Proposal
        title="Assign 421.76€ across 2 categories"
        footnote="Leaves 0.00€ ready to assign"
        appliedLabel="Applied · 2 categories funded"
        applied={applied}
        onApply={() => setApplied(true)}
        lines={[
          {
            icon: <Wrench className="text-text-tertiary size-[15px]" />,
            label: "Home Maintenance",
            positive: true,
            value: "+277.85€",
          },
          {
            icon: <Zap className="text-text-tertiary size-[15px]" />,
            label: "Energy",
            positive: true,
            value: "+143.91€",
          },
        ]}
      />
      <Suggestions
        suggestions={[
          {
            icon: CircleAlert,
            label: "Cover Eating Out",
            run: fn(),
          },
          {
            icon: CalendarDays,
            label: "Where did October go?",
            run: fn(),
          },
        ]}
      />
    </div>
  );
};

const meta = {
  component: Thread,
  title: "Agent/Thread",
} satisfies Meta<typeof Thread>;

export default meta;

export const Conversation: StoryObj<typeof meta> = {};
