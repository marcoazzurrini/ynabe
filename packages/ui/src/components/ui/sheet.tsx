"use client";

import { Drawer } from "@base-ui/react/drawer";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  /** Called when a swipe down, the scrim, the close button, or Escape closes it. */
  onClose: () => void;
  /** Names the sheet for screen readers, and shows at its top. */
  title: ReactNode;
  /** A line under the title. */
  caption?: ReactNode;
  /** Sits before the title, such as an icon tile. */
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A panel that rises from the bottom of a phone screen and follows the
 * finger when swiped away. The page behind stays where it was.
 */
function Sheet({
  open,
  onClose,
  title,
  caption,
  lead,
  children,
  className,
}: SheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/30 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup
            data-slot="sheet"
            className={cn(
              "shadow-window flex max-h-[calc(100dvh-3rem)] w-full max-w-[560px] translate-y-(--drawer-swipe-movement-y) flex-col rounded-t-[28px] bg-white outline-none",
              "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:translate-y-full data-starting-style:translate-y-full data-swiping:duration-0 data-swiping:select-none",
              className
            )}
          >
            <span
              aria-hidden
              className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-gray-300"
            />
            <header className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-2">
              {lead}
              <div className="flex min-w-0 flex-1 flex-col">
                <Drawer.Title className="truncate text-[19px] leading-6 font-semibold tracking-tight">
                  {title}
                </Drawer.Title>
                {caption ? (
                  <Drawer.Description className="text-text-tertiary truncate text-[13px] font-medium">
                    {caption}
                  </Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close
                aria-label="Close"
                className="bg-surface-sunken text-text-secondary flex size-8 shrink-0 items-center justify-center rounded-full transition-transform duration-100 active:scale-95"
              >
                <XIcon className="size-4" aria-hidden />
              </Drawer.Close>
            </header>
            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export { Sheet };
