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
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import {
  AssistantMessage,
  Proposal,
  Steps,
  Suggestions,
  UserMessage,
} from "./parts";
import { useAgent } from "./state";
import { useThread } from "./use-thread";

const time = () =>
  new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  });

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

  const submit = () => {
    const text = draft.trim();

    if (text !== "") {
      thread.send(text);
      setDraft("");
    }
  };

  return (
    <aside className="border-border bg-surface-app flex w-[640px] shrink-0 flex-col border-l">
      <header className="border-border flex h-[52px] shrink-0 items-center gap-3 border-b pr-4 pl-9">
        <p className="flex flex-1 items-baseline gap-2">
          <span className="text-sm font-semibold">Ledger</span>
          <span className="text-text-tertiary text-xs font-medium">
            Watching {thread.context}
          </span>
        </p>
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
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-9 py-7">
        <p className="text-text-tertiary self-center text-xs font-medium">
          Today, {time()}
        </p>
        {thread.insight ? (
          <AssistantMessage>{thread.insight}</AssistantMessage>
        ) : null}
        {thread.exchanges.map((exchange) => (
          <div key={exchange.id} className="flex flex-col gap-5">
            <UserMessage>{exchange.user}</UserMessage>
            {exchange.steps.length > 0 ? (
              <Steps steps={exchange.steps} />
            ) : null}
            <AssistantMessage>{exchange.reply}</AssistantMessage>
            {exchange.proposal ? (
              <Proposal
                title={exchange.proposal.title}
                lines={exchange.proposal.lines}
                footnote={exchange.proposal.footnote}
                applied={thread.applied.includes(exchange.id)}
                appliedLabel={exchange.proposal.appliedLabel}
                onApply={() => {
                  exchange.proposal?.apply();
                  thread.markApplied(exchange.id);
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 px-9 pb-7">
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
