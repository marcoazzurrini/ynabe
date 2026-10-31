import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    // The app runs in the browser against server functions; the server
    // only renders a shell, so collections never run during SSR.
    tanstackStart({
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
    react(),
  ],
  preview: { host: "127.0.0.1" },
  resolve: { tsconfigPaths: true },
});
