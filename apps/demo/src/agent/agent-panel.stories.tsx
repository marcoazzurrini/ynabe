import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentPanel } from "@ynabe/web/components/agent-panel";

const meta = {
  args: { context: "Plan · October" },
  component: AgentPanel,
  decorators: [
    (Story) => (
      <div className="flex h-screen justify-end">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "Agent/Panel",
} satisfies Meta<typeof AgentPanel>;

export default meta;

export const Empty: StoryObj<typeof meta> = {};
