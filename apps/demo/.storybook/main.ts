import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const config: StorybookConfig = {
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.mdx", "../src/**/*.stories.tsx"],
  viteFinal: (vite) => ({
    ...vite,
    plugins: [...(vite.plugins ?? []), tailwindcss()],
    resolve: { ...vite.resolve, tsconfigPaths: true },
  }),
};

export default config;
