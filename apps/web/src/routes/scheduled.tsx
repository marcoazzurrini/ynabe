import { createFileRoute } from "@tanstack/react-router";
import { Repeat } from "lucide-react";

import { Topbar } from "../components/topbar";

const ScheduledScreen = () => (
  <>
    <Topbar icon={Repeat} title="Scheduled" />
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <span className="shadow-card flex size-12 items-center justify-center rounded-[14px] bg-white">
        <Repeat className="text-text-tertiary size-[22px]" aria-hidden />
      </span>
      <h1 className="text-[15px] font-semibold">
        No scheduled transactions yet
      </h1>
      <p className="text-text-tertiary max-w-[420px] text-[13px] leading-5 font-medium">
        Rent, subscriptions, and other repeating payments will show here, so
        Plan can see them coming.
      </p>
    </div>
  </>
);

export const Route = createFileRoute("/scheduled")({
  component: ScheduledScreen,
});
