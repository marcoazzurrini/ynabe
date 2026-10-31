import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/routeTree.gen.ts",
    "packages/db/migrations/**",
    ".penna/**",
    "bun.lock",
  ],
});
