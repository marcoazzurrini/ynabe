import type { Meta, StoryObj } from "@storybook/react-vite";
import { UsualRange } from "@ynabe/ui/components/usual-range";

const meta = {
  args: { average: 21_400, high: 24_000, low: 15_000, value: 29_640 },
  component: UsualRange,
  decorators: [
    (Story) => (
      <div className="w-[460px]">
        <Story />
      </div>
    ),
  ],
  title: "Charts/Usual range",
} satisfies Meta<typeof UsualRange>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AboveUsual: Story = {};

export const WithinUsual: Story = {
  args: { average: 107_000, high: 118_000, low: 94_000, value: 102_924 },
};
