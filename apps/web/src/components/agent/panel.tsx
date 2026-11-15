import { Button } from "@ynabe/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@ynabe/ui/components/ui/input-group";
import { Kbd } from "@ynabe/ui/components/ui/kbd";
import {
  ArrowUp,
  Brain,
  CalendarDays,
  ChartPie,
  LayoutList,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { decide } from "../../data/thread";
import type { ThreadMessage } from "../../data/thread";
import { CategoryIcon } from "../category-icon";
import {
  AssistantMessage,
  Proposal,
  Steps,
  Suggestions,
  UserMessage,
} from "./parts";
import { useAgent } from "./state";
import { useThread } from "./use-thread";

const stepIcons = {
  memory: Brain,
  overview: LayoutList,
  plan: CalendarDays,
  report: ChartPie,
  search: Search,
} satisfies Record<ThreadMessage["steps"][number]["kind"], LucideIcon>;

const iconsFor = (steps: ThreadMessage["steps"]) =>
  steps.map(({ kind, label }) => ({ icon: stepIcons[kind], label }));

const dayOf = (at: number) => new Date(at).toDateString();

const dayLabel = (at: number) => {
  const time = new Date(at).toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });

  const day =
    dayOf(at) === dayOf(Date.now())
      ? "Today"
      : new Date(at).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });

  return `${day}, ${time}`;
};

/** One message of the conversation, with what the assistant did for it. */
const Message = ({ message }: { message: ThreadMessage }) => {
  if (message.role === "user") {
    return <UserMessage>{message.text}</UserMessage>;
  }

  return (
    <>
      {message.trigger === "sync" ? (
        <p className="text-text-tertiary text-xs font-medium">
          After a bank sync
        </p>
      ) : null}
      {message.steps.length > 0 ? (
        <Steps steps={iconsFor(message.steps)} />
      ) : null}
      <AssistantMessage>{message.text}</AssistantMessage>
      {message.proposals.map((proposal) => (
        <Proposal
          key={proposal.id}
          title={proposal.title}
          footnote={proposal.footnote}
          lines={proposal.lines.map((line, index) => ({
            ...line,
            icon: <CategoryIcon name={line.icon} />,
            id: String(index),
          }))}
          applied={proposal.status === "applied"}
          appliedLabel={`Applied · ${proposal.title}`}
          dismissed={proposal.status === "dismissed"}
          onApply={() => {
            void decide(proposal.id, true);
          }}
          onDismiss={() => {
            void decide(proposal.id, false);
          }}
        />
      ))}
    </>
  );
};

/** The collapsed assistant: a thin strip that reopens with ⌘J. */
export const AgentRail = () => {
  const { toggle } = useAgent();

  return (
    <aside className="border-border bg-surface-app flex w-14 shrink-0 flex-col items-center gap-3 border-l py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label="Open the assistant"
        className="bg-text-primary shadow-button flex size-7 items-center justify-center rounded-lg"
      >
        <Sparkles className="size-3.5 text-white" aria-hidden />
      </button>
      <div className="bg-border h-px w-6" />
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label="Open the assistant"
      >
        <PanelRightOpen />
      </Button>
      <div className="flex-1" />
      <Kbd>⌘J</Kbd>
    </aside>
  );
};

/** The always-on assistant. Proposals need applying before anything changes. */
export const AgentPanel = () => {
  const { toggle } = useAgent();
  const thread = useThread();
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const { messages, pending } = thread;

  // Keep the newest words in view as they arrive.
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- these are what make the thread grow
  }, [messages.length, pending?.text, pending?.steps.length]);

  const submit = () => {
    const text = draft.trim();

    if (text !== "" && !pending) {
      void thread.send(text);
      setDraft("");
    }
  };

  return (
    <aside className="border-border bg-surface-app flex w-[clamp(360px,25vw,640px)] shrink-0 flex-col border-l">
      <header className="border-border flex h-[52px] shrink-0 items-center gap-3 border-b pr-4 pl-9">
        <span className="flex-1" />
        <Kbd>⌘J</Kbd>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Collapse the assistant"
        >
          <PanelRightClose />
        </Button>
      </header>
      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-9 py-7"
      >
        {messages.map((message, index) => (
          <div key={message.id} className="flex flex-col gap-5">
            {dayOf(message.at) ===
            dayOf(messages[index - 1]?.at ?? 0) ? null : (
              <p className="text-text-tertiary self-center text-xs font-medium">
                {dayLabel(message.at)}
              </p>
            )}
            <Message message={message} />
          </div>
        ))}
        {pending ? (
          <div className="flex flex-col gap-5">
            <UserMessage>{pending.user}</UserMessage>
            {pending.steps.length > 0 ? (
              <Steps steps={iconsFor(pending.steps)} />
            ) : null}
            {pending.text === "" ? (
              <p className="text-text-tertiary text-sm leading-[22px] font-medium">
                Thinking…
              </p>
            ) : (
              <AssistantMessage>{pending.text}</AssistantMessage>
            )}
          </div>
        ) : null}
        {thread.notice ? (
          <output className="text-text-secondary text-[13px] font-medium">
            {thread.notice}
          </output>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 px-9 pb-7">
        <p className="text-text-secondary text-[13px] leading-5 font-medium">
          {thread.connected
            ? thread.insight
            : "The assistant is not set up yet, so it cannot answer."}
        </p>
        <Suggestions suggestions={thread.suggestions} />
        <InputGroup className="rounded-2xl bg-white">
          <InputGroupTextarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="Ask Ledger, or tell it what to change…"
            className="min-h-11 text-sm"
          />
          <InputGroupAddon align="block-end">
            <InputGroupButton
              variant="outline"
              size="icon-sm"
              className="rounded-full"
              aria-label="Attach a file"
            >
              <Plus />
            </InputGroupButton>
            <span className="text-text-tertiary ml-auto text-xs font-medium">
              {thread.context}
            </span>
            <InputGroupButton
              variant="default"
              size="icon-sm"
              className="rounded-full"
              aria-label="Send"
              disabled={pending !== null}
              onClick={submit}
            >
              <ArrowUp />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </aside>
  );
};
