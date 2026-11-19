import { useSyncExternalStore } from "react";

/** Below this width the app shows its phone layout. Tailwind's `md`. */
const QUERY = "(max-width: 767px)";

const subscribe = (notify: () => void) => {
  const media = window.matchMedia(QUERY);

  media.addEventListener("change", notify);

  return () => media.removeEventListener("change", notify);
};

/** True right now, for code that runs outside a component. */
export const isPhone = (): boolean => window.matchMedia(QUERY).matches;

/**
 * True on a screen as narrow as a phone. Screens whose phone layout is a
 * different structure ask this; the rest only use `max-md:` classes.
 */
export const usePhone = (): boolean =>
  useSyncExternalStore(subscribe, isPhone, () => false);
