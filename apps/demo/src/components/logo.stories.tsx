import type { Meta, StoryObj } from "@storybook/react-vite";
import { Logo, LogoTile, Wordmark } from "@ynabe/ui/components/logo";

const meta = {
  args: { size: 64 },
  component: Logo,
  title: "Brand/Logo",
} satisfies Meta<typeof Logo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Mark: Story = {};

export const Tile: Story = {
  render: (args) => <LogoTile {...args} />,
};

export const WithName: Story = {
  args: { size: 32 },
  render: (args) => <Wordmark {...args} />,
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      {[16, 20, 32, 64].map((size) => (
        <LogoTile key={size} size={size} />
      ))}
    </div>
  ),
};
