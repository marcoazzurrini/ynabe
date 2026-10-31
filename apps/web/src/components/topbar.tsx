import { Button } from "@ynabe/ui/components/ui/button";
import { Ellipsis, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface TopbarProps {
  icon: LucideIcon;
  title: string;
  context?: string;
  actions?: ReactNode;
}

/** The breadcrumb bar at the top of a screen. */
export const Topbar = ({
  icon: Icon,
  title,
  context,
  actions,
}: TopbarProps) => (
  <div className="border-border flex h-[52px] shrink-0 items-center justify-between border-b px-5">
    <p className="text-text-tertiary flex items-center gap-2 text-[13px] font-medium">
      <Icon className="size-[15px]" aria-hidden />
      <span className="text-text-primary">{title}</span>
      {context ? (
        <>
          <span className="text-gray-400">/</span>
          <span>{context}</span>
        </>
      ) : null}
    </p>
    <div className="flex items-center gap-2">
      <span className="flex">
        <span className="size-[22px] rounded-full border-2 border-white bg-[linear-gradient(135deg,#9b69ff,#266df0)]" />
        <span className="-ml-1.5 size-[22px] rounded-full border-2 border-white bg-[linear-gradient(135deg,#f5a524,#f0545a)]" />
      </span>
      {actions ?? (
        <Button variant="outline">
          <UserPlus />
          Share
        </Button>
      )}
      <Button variant="outline" size="icon" aria-label="More">
        <Ellipsis />
      </Button>
    </div>
  </div>
);
