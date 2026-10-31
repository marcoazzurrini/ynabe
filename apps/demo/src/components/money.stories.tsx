import type { Meta, StoryObj } from "@storybook/react-vite";
import { Money } from "@ynabe/ui/components/money";

const meta = {
  args: { cents: 191_816 },
  component: Money,
  title: "Money/Money",
} satisfies Meta<typeof Money>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

export const Inflow: Story = {
  args: { cents: 325_000, sign: true, tone: "meaning" },
};

export const Negative: Story = {
  args: { cents: -224_124, tone: "meaning" },
};
