import {
  signIn as googleSignIn,
  signOut as googleSignOut,
} from "@ynabe/auth/client";
import { useSyncExternalStore } from "react";
import { z } from "zod";

const sessionSchema = z.object({
  configured: z.boolean(),
  user: z
    .object({
      email: z.string(),
      image: z.string().nullable(),
      name: z.string(),
    })
    .nullable(),
});

export type Account = NonNullable<z.infer<typeof sessionSchema>["user"]>;

export type SessionState =
  | { status: "checking" }
  | { status: "error"; message: string }
  | { status: "unconfigured" }
  | { status: "signed-out"; expired: boolean }
  | { status: "signed-in"; account: Account };

let state: SessionState = { status: "checking" };
const listeners = new Set<() => void>();

const set = (next: SessionState) => {
  state = next;

  for (const listener of listeners) {
    listener();
  }
};

/** Asks the Worker who is signed in. */
export const checkSession = async (): Promise<void> => {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Could not check whether you are signed in.");
    }

    const session = sessionSchema.parse(await response.json());

    if (!session.configured) {
      set({ status: "unconfigured" });
    } else if (session.user) {
      set({ account: session.user, status: "signed-in" });
    } else {
      set({ expired: state.status === "signed-in", status: "signed-out" });
    }
  } catch (error) {
    set({
      message:
        error instanceof Error ? error.message : "Could not check access.",
      status: "error",
    });
  }
};

/** Leaves for Google, then comes back to this page. */
export const signIn = (): Promise<void> => googleSignIn();

export const signOut = async (): Promise<void> => {
  await googleSignOut();
  set({ expired: false, status: "signed-out" });
};

export const useSession = (): SessionState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
