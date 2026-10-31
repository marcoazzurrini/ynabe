import type { Meta, StoryObj } from "@storybook/react-vite";
import { Envelope } from "@ynabe/ui/components/envelope";

const meta = {
  args: { cents: 24_785, progress: 0.89, state: "underfunded" },
  argTypes: {
    progress: { control: { max: 1, min: 0, step: 0.01, type: "range" } },
    state: {
      control: "inline-radio",
      options: ["funded", "available", "underfunded", "overspent", "empty"],
    },
  },
  component: Envelope,
  title: "Money/Envelope",
} satisfies Meta<typeof Envelope>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Underfunded: Story = {};

export const Funded: Story = {
  args: { cents: 40_000, progress: 1, state: "funded" },
};

export const Available: Story = {
  args: { cents: 1_550_000, progress: 0.78, state: "available" },
};

export const Overspent: Story = {
  args: { cents: -5240, progress: 1, state: "overspent" },
};

export const Empty: Story = {
  args: { cents: 0, progress: 0, state: "empty" },
};
