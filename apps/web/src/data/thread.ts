import { agentEvent, eventsFrom } from "@ynabe/agent/events";
import type { AgentEvent } from "@ynabe/agent/events";
import type { AgentStep } from "@ynabe/db/thread";
import { useSyncExternalStore } from "react";

import { decideProposal, getThread, sendMessage } from "../server/agent";
import { queryClient } from "./collections";

export type ThreadMessage = Awaited<
  ReturnType<typeof getThread>
>["messages"][number];

export type ThreadProposal = ThreadMessage["proposals"][number];

interface Pending {
  /** What the owner just sent. */
  user: string;
  steps: AgentStep[];
  /** The answer so far. */
  text: string;
}

interface ThreadState {
  /** False until the server says the assistant is set up. */
  connected: boolean;
  messages: ThreadMessage[];
  /** The exchange in progress, or null. */
  pending: Pending | null;
  /** Why the last message got no answer, or a warning about the plan. */
  notice: string | null;
}

let state: ThreadState = {
  connected: true,
  messages: [],
  notice: null,
  pending: null,
};

const listeners = new Set<() => void>();

const update = (change: Partial<ThreadState>) => {
  state = { ...state, ...change };

  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * The conversation with the assistant. It lives outside the panel, so
 * an answer keeps arriving while the panel is collapsed.
 */
export const useThreadState = (): ThreadState =>
  useSyncExternalStore(subscribe, () => state);

/** Reads the conversation from the server. */
export const loadThread = async (): Promise<void> => {
  const { connected, messages } = await getThread();

  update({ connected, messages });
};

const resetTime = (seconds: number | null): string =>
  seconds === null
    ? ""
    : ` It resets at ${new Date(seconds * 1000).toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, minute: "2-digit" })}.`;

const hear = (event: AgentEvent, pending: Pending): Pending => {
  if (event.type === "turn") {
    return { ...pending, text: "" };
  }

  if (event.type === "text") {
    return { ...pending, text: pending.text + event.text };
  }

  if (event.type === "step") {
    return { ...pending, steps: [...pending.steps, event.step] };
  }

  if (event.type === "limit") {
    update({
      notice: `Your Claude plan is close to its limit.${resetTime(event.resetsAt)}`,
    });
  } else if (event.type === "error") {
    update({ notice: event.message });
  }

  return pending;
};

interface Outgoing {
  text: string;
  /** The screen the owner has open, and its month. */
  screen: string;
  month: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

const today = (): string => {
  const now = new Date();

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Sends the assistant a message and follows the answer as it is written. */
export const send = async ({
  text,
  screen,
  month,
}: Outgoing): Promise<void> => {
  if (state.pending) {
    return;
  }

  let pending: Pending = { steps: [], text: "", user: text };

  update({ notice: null, pending });

  try {
    const response = await sendMessage({
      data: { month, screen, text, today: today() },
    });

    for await (const event of eventsFrom(response, agentEvent)) {
      pending = hear(event, pending);
      update({ pending });
    }
  } catch {
    update({ notice: "The assistant could not be reached. Try again." });
  }

  try {
    await loadThread();
  } finally {
    update({ pending: null });
  }
};

/** Applies a proposal to the budget, or sets it aside. */
export const decide = async (id: string, apply: boolean): Promise<void> => {
  await decideProposal({ data: { apply, id } });

  if (apply) {
    await queryClient.invalidateQueries({ queryKey: ["budget"] });
  }

  await loadThread();
};
