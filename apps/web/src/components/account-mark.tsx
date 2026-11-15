import { cn } from "@ynabe/ui/lib/utils";

/** Banks with an icon in `public/banks`, keyed by account id. */
const icons = new Set(["illimity", "monzo", "revolut", "tinaba"]);

/** The bank's icon for an account, or its initial when there is none. */
export const AccountMark = ({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) =>
  icons.has(id) ? (
    <img
      src={`/banks/${id}.png`}
      alt=""
      title={name}
      className={cn(
        "size-[18px] shrink-0 rounded-[5px] bg-white object-contain ring-1 ring-black/10",
        className
      )}
    />
  ) : (
    <span
      aria-hidden
      title={name}
      className={cn(
        "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-gray-600 text-[11px] leading-none font-bold text-white",
        className
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
