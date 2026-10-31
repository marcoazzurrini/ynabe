import "@ynabe/ui/globals.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  decorators: [
    (Story, { parameters }) => (
      <div
        className={
          parameters.layout === "fullscreen"
            ? "bg-background min-h-screen"
            : "bg-surface-app text-text-primary min-h-screen p-8 font-sans"
        }
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    a11y: { test: "error" },
    layout: "padded",
  },
};

export default preview;
