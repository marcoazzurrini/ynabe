import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface AgentState {
  open: boolean;
  toggle: () => void;
}

const AgentContext = createContext<AgentState | null>(null);

/** Whether the assistant column is open; ⌘J toggles it. */
export const AgentProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({ open, toggle: () => setOpen((current) => !current) }),
    [open]
  );

  return <AgentContext value={value}>{children}</AgentContext>;
};

export const useAgent = (): AgentState => {
  const state = useContext(AgentContext);

  if (!state) {
    throw new Error("useAgent needs an AgentProvider above it");
  }

  return state;
};
