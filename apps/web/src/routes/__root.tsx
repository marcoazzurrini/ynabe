import {
  ClientOnly,
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AgentPanel } from "../components/agent-panel";
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

const contexts = new Map([
  ["/accounts", "Accounts"],
  ["/plan", "Plan"],
  ["/reflect", "Reflect"],
]);

const AppShell = () => {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Collections live in the browser, so screens render there only. */}
        <ClientOnly>
          <Outlet />
        </ClientOnly>
      </main>
      <AgentPanel context={contexts.get(pathname) ?? "ynabe"} />
    </div>
  );
};

export const Route = createRootRoute({
  component: AppShell,
  head: () => ({
    links: [{ href: globals, rel: "stylesheet" }],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: "ynabe" },
    ],
  }),
  shellComponent: RootDocument,
});
