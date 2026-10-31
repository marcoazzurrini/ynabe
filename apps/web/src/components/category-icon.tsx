import { cn } from "@ynabe/ui/lib/utils";
import { DynamicIcon, iconNames } from "lucide-react/dynamic";
import type { IconName } from "lucide-react/dynamic";

const isIconName = (name: string): name is IconName =>
  iconNames.some((known) => known === name);

/** A category's Lucide icon, in the tertiary text color. */
export const CategoryIcon = ({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) => (
  <DynamicIcon
    name={name && isIconName(name) ? name : "circle-dashed"}
    className={cn("text-text-tertiary size-[15px] shrink-0", className)}
    aria-hidden
  />
);
