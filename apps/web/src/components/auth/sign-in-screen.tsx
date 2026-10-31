import { ACCOUNT_NOT_ALLOWED } from "@ynabe/auth/client";
import { cn } from "@ynabe/ui/lib/utils";
import { Clock, Lock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { signIn } from "../../data/session";
import type { SessionState } from "../../data/session";

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
    />
  </svg>
);

/** The app's mark: a dark tile with a white L. */
export const Mark = ({ size = 36 }: { size?: number }) => (
  <span
    aria-hidden
    className="bg-text-primary shadow-button relative block shrink-0 rounded-[10px]"
    style={{ height: size, width: size }}
  >
    <span
      className="absolute rounded-full bg-white"
      style={{
        height: size * 0.44,
        left: size * 0.3,
        top: size * 0.25,
        width: size * 0.1,
      }}
    />
    <span
      className="absolute rounded-full bg-white"
      style={{
        height: size * 0.1,
        left: size * 0.3,
        top: size * 0.61,
        width: size * 0.36,
      }}
    />
  </span>
);

const Notice = ({
  tone,
  icon,
  title,
  children,
}: {
  tone: "error" | "info";
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <div
    role={tone === "error" ? "alert" : "status"}
    className={cn(
      "flex w-full gap-3 rounded-xl px-3.5 py-3 text-[13px] leading-[19px] font-medium",
      tone === "error"
        ? "bg-over-bg text-over ring-over-border ring-1 ring-inset"
        : "bg-surface-sunken text-text-secondary"
    )}
  >
    {icon}
    <div className="flex flex-col gap-1">
      <p
        className={cn("font-semibold", tone === "info" && "text-text-primary")}
      >
        {title}
      </p>
      <p className={tone === "error" ? "text-[#9b2a31]" : undefined}>
        {children}
      </p>
    </div>
  </div>
);

const notAllowed = () =>
  new URLSearchParams(location.search).get("error") === ACCOUNT_NOT_ALLOWED;

/** The only thing a signed-out visitor sees. */
export const SignInScreen = ({ session }: { session: SessionState }) => {
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const rejected = notAllowed();
  const checking = session.status === "checking";

  const start = async () => {
    setStarting(true);
    setFailure(null);

    try {
      await signIn();
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : "Sign-in could not start."
      );
      setStarting(false);
    }
  };

  let notice: ReactNode = null;

  if (rejected) {
    notice = (
      <Notice
        tone="error"
        icon={<ShieldAlert className="size-4 shrink-0" aria-hidden />}
        title="This Google account can’t sign in"
      >
        ynabe is private. Choose the account it was set up for.
      </Notice>
    );
  } else if (session.status === "signed-out" && session.expired) {
    notice = (
      <Notice
        tone="info"
        icon={
          <Clock className="text-text-tertiary size-4 shrink-0" aria-hidden />
        }
        title="You were signed out"
      >
        Your session ended. Sign in again to pick up where you left off.
      </Notice>
    );
  } else if (
    session.status === "error" ||
    session.status === "unconfigured" ||
    failure
  ) {
    notice = (
      <Notice
        tone="error"
        icon={<ShieldAlert className="size-4 shrink-0" aria-hidden />}
        title="Sign-in isn’t available"
      >
        {failure ??
          (session.status === "error"
            ? session.message
            : "Google sign-in has not been set up on this server yet.")}
      </Notice>
    );
  }

  return (
    <main className="bg-surface-app relative flex h-dvh flex-col items-center justify-center bg-[linear-gradient(90deg,rgb(0_0_0/0.035)_1px,transparent_1px)] bg-[length:160px_100%]">
      <section className="shadow-window flex w-[440px] flex-col items-center gap-6 rounded-2xl bg-white px-10 pt-10 pb-8">
        <Mark />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-[28px] leading-8 font-semibold tracking-tight">
            Sign in to ynabe
          </h1>
          <p className="text-text-tertiary text-sm font-medium">
            Your budget, planned with Ledger.
          </p>
        </div>
        {notice}
        {checking ? (
          <p className="bg-surface-sunken text-text-tertiary flex h-11 w-full items-center justify-center gap-3 rounded-xl text-sm font-medium">
            <span
              className="border-t-text-primary size-4 animate-spin rounded-full border-2 border-gray-300"
              aria-hidden
            />
            Checking your session…
          </p>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={starting || session.status === "unconfigured"}
            className="border-border-control hover:bg-surface-app flex h-11 w-full items-center justify-center gap-3 rounded-xl border bg-white text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.05)] disabled:opacity-50"
          >
            <GoogleLogo />
            {rejected ? "Use another Google account" : "Continue with Google"}
          </button>
        )}
        <p className="text-text-tertiary flex items-center gap-2 text-xs font-medium">
          <Lock className="size-3" aria-hidden />
          Private budget. Only its owner can sign in.
        </p>
      </section>
      <p className="text-text-disabled absolute bottom-8 text-xs font-medium">
        © 2026 ynabe
      </p>
    </main>
  );
};
