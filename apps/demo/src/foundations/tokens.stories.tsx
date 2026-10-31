import type { Meta, StoryObj } from "@storybook/react-vite";

const swatches = [
  [
    "Text",
    ["text-primary", "text-secondary", "text-tertiary", "text-disabled"],
  ],
  [
    "Surfaces",
    ["surface-app", "surface-panel", "surface-sunken", "surface-selected"],
  ],
  [
    "Money",
    ["money-funded-fg", "money-under-fg", "money-over-fg", "money-inflow"],
  ],
  [
    "Envelope",
    ["envelope-track", "envelope-funded", "envelope-partial", "envelope-over"],
  ],
  ["Charts", ["chart-1", "chart-2", "chart-3", "chart-other"]],
  ["Sequential", ["seq-0", "seq-1", "seq-2", "seq-3", "seq-4"]],
] as const;

const Tokens = () => (
  <div className="flex flex-col gap-8">
    {swatches.map(([group, names]) => (
      <section key={group} className="flex flex-col gap-3">
        <h2 className="text-text-tertiary text-xs font-medium">{group}</h2>
        <div className="flex flex-wrap gap-3">
          {names.map((name) => (
            <figure
              key={name}
              className="m-0 w-32 overflow-hidden rounded-[10px] bg-white shadow-xs"
            >
              <div className="h-16" style={{ background: `var(--${name})` }} />
              <figcaption className="text-text-tertiary px-2.5 py-2 font-mono text-[11px]">
                --{name}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    ))}
  </div>
);

const meta = {
  component: Tokens,
  title: "Foundations/Tokens",
} satisfies Meta<typeof Tokens>;

export default meta;

export const All: StoryObj<typeof meta> = {};
