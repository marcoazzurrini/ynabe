import {
  ClientOnly,
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { z } from "zod";

import { AgentPanel, AgentRail } from "../components/agent/panel";
import { AgentProvider, useAgent } from "../components/agent/state";
import { SignInScreen } from "../components/auth/sign-in-screen";
import { Sidebar } from "../components/sidebar";
import { checkSession, useSession } from "../data/session";

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

/** Nothing of the budget renders, or loads, until an allowed account is signed in. */
const Gate = () => {
  const session = useSession();

  useEffect(() => {
    checkSession().catch(() => null);
  }, []);

  if (session.status !== "signed-in") {
    return <SignInScreen session={session} />;
  }

  return (
    <AgentProvider>
      <Shell />
    </AgentProvider>
  );
};

/** Collections live in the browser, so the whole app renders there. */
const App = () => (
  <ClientOnly>
    <Gate />
  </ClientOnly>
);

const search = z.object({
  account: z.string().optional(),
  month: z.string().optional(),
});

const ErrorScreen = ({ error }: ErrorComponentProps) => (
  <main className="bg-surface-app flex h-dvh flex-col items-center justify-center gap-3 text-center">
    <h1 className="text-[15px] font-semibold">Something went wrong</h1>
    <p className="text-text-tertiary max-w-[420px] text-[13px] leading-5 font-medium">
      {error instanceof Error
        ? error.message
        : "The app hit an unexpected error."}
    </p>
    <button
      type="button"
      onClick={() => location.reload()}
      className="border-border-control h-8 rounded-[10px] border bg-white px-3 text-[13px] font-medium"
    >
      Reload
    </button>
  </main>
);

export const Route = createRootRoute({
  component: App,
  errorComponent: ErrorScreen,
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
