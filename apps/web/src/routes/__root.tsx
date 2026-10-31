import {
  ClientOnly,
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { z } from "zod";

import { AgentPanel, AgentRail } from "../components/agent/panel";
import { AgentProvider, useAgent } from "../components/agent/state";
import { Sidebar } from "../components/sidebar";

import globals from "@ynabe/ui/globals.css?url";

const RootDocument = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <head>
      <HeadContent />
    </head>
    <body>
      {children}
      <Scripts />
    </body>
  </html>
);

const Shell = () => {
  const { open } = useAgent();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      {open ? <AgentPanel /> : <AgentRail />}
    </div>
  );
};

/** Collections live in the browser, so the whole app renders there. */
const App = () => (
  <ClientOnly>
    <AgentProvider>
      <Shell />
    </AgentProvider>
  </ClientOnly>
);

const search = z.object({
  account: z.string().optional(),
  month: z.string().optional(),
});

export const Route = createRootRoute({
  component: App,
  head: () => ({
    links: [{ href: globals, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "ynabe" },
    ],
  }),
  shellComponent: RootDocument,
  validateSearch: search,
});
