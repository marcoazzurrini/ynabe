import { Button } from "@ynabe/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@ynabe/ui/components/ui/input-group";
import { Kbd } from "@ynabe/ui/components/ui/kbd";
import { Message, MessageContent } from "@ynabe/ui/components/ui/message";
import { ArrowUp, PanelRightClose, Plus } from "lucide-react";

interface AgentPanelProps {
  /** What the agent is looking at, such as "Plan · October". */
  context: string;
}

/** The always-on assistant. Proposals need confirming before they apply. */
export const AgentPanel = ({ context }: AgentPanelProps) => (
  <aside className="border-border bg-surface-app flex w-[640px] shrink-0 flex-col border-l">
    <header className="border-border flex h-[52px] items-center gap-3 border-b pr-4 pl-9">
      <p className="flex flex-1 items-baseline gap-2">
        <span className="text-sm font-semibold">Ledger</span>
        <span className="text-text-tertiary text-xs font-medium">
          Watching {context}
        </span>
      </p>
      <Kbd>⌘J</Kbd>
      <Button variant="ghost" size="icon" aria-label="Collapse the assistant">
        <PanelRightClose />
      </Button>
    </header>
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-9 py-7">
      <Message>
        <MessageContent className="text-sm leading-[22px] font-medium">
          Ask me where your money went, or tell me what to change. I’ll propose
          it first, and nothing changes until you apply it.
        </MessageContent>
      </Message>
    </div>
    <div className="px-9 pb-7">
      <InputGroup className="rounded-2xl bg-white">
        <InputGroupTextarea
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
            {context}
          </span>
          <InputGroupButton
            variant="default"
            size="icon-sm"
            className="rounded-full"
            aria-label="Send"
          >
            <ArrowUp />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  </aside>
);
