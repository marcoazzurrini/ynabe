import { cn } from "@ynabe/ui/lib/utils";

const gradients = new Map([
  ["illimity", "linear-gradient(135deg,#ffb36b,#f0545a)"],
  ["monzo", "linear-gradient(135deg,#ff7a8a,#e8436b)"],
  ["revolut", "linear-gradient(135deg,#3a3e46,#0c0c0c)"],
  ["tinaba", "linear-gradient(135deg,#36d1a1,#007d53)"],
]);

/** The small colored square that stands for an account. */
export const AccountMark = ({
  id,
  className,
}: {
  id: string;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn("size-4 shrink-0 rounded-[5px]", className)}
    style={{
      background:
        gradients.get(id) ?? "linear-gradient(135deg,#b5bcc7,#6f7684)",
    }}
  />
);
