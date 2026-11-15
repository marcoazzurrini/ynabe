import { cn } from "@ynabe/ui/lib/utils";

/*
 * The ynabe mark: a ring with one gap, and a coin landing in it. The coin is
 * as wide as the ring, so it completes the circle: every euro has a job.
 * Drawn on a 100 x 100 grid; public/favicon.svg and the PNG icons copy it.
 */
const Ring = ({ ring, coin }: { ring: string; coin: string }) => (
  <>
    <circle
      cx="50"
      cy="50"
      r="27"
      fill="none"
      stroke={ring}
      strokeWidth="12"
      strokeLinecap="round"
      pathLength={100}
      strokeDasharray="82 18"
    />
    <circle cx="72.8" cy="35.53" r="7" fill={coin} />
  </>
);

export interface LogoProps {
  /** Width and height in pixels. */
  size?: number;
  className?: string;
}

/** The bare mark. The ring takes the text color; the coin is always green. */
export const Logo = ({ size = 24, className }: LogoProps) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    aria-hidden
    className={cn("shrink-0", className)}
  >
    <Ring ring="currentColor" coin="var(--green-500)" />
  </svg>
);

/** The mark on an ink tile, as the app icon. Used where the mark stands alone. */
export const LogoTile = ({ size = 36, className }: LogoProps) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    aria-hidden
    className={cn("shrink-0", className)}
  >
    <rect width="100" height="100" rx="28" fill="var(--ink)" />
    <g transform="translate(50 50) scale(0.8) translate(-50 -50)">
      <Ring ring="#fff" coin="var(--green-500)" />
    </g>
  </svg>
);

/** The mark beside the name. */
export const Wordmark = ({ size = 24, className }: LogoProps) => (
  <span
    className={cn("text-text-primary inline-flex items-center", className)}
    style={{ gap: size * 0.36 }}
  >
    <Logo size={size} />
    <span
      className="font-semibold tracking-[-0.035em]"
      style={{ fontSize: size * 0.75, lineHeight: 1 }}
    >
      ynabe
    </span>
  </span>
);
