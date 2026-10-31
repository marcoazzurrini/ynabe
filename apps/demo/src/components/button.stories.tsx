import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@ynabe/ui/components/ui/button";
import { Plus } from "lucide-react";

const meta = {
  args: { children: "Add transaction" },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: [
        "default",
        "outline",
        "secondary",
        "ghost",
        "destructive",
        "link",
      ],
    },
  },
  component: Button,
  title: "Controls/Button",
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Outline: Story = { args: { variant: "outline" } };

export const Ghost: Story = { args: { variant: "ghost" } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus />
        Add transaction
      </>
    ),
  },
};
