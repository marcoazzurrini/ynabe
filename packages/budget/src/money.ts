import type { Cents } from "./types.ts";

interface FormatOptions {
  locale?: string;
  /** Show `+` on positive amounts, for inflows and deltas. */
  sign?: boolean;
}

/** Formats cents the way the app shows money: `1,918.16€`. */
export const formatMoney = (
  cents: Cents,
  { locale = "en-US", sign = false }: FormatOptions = {}
): string => {
  const digits = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Math.abs(cents) / 100);

  let prefix = "";

  if (cents < 0) {
    prefix = "-";
  } else if (sign && cents > 0) {
    prefix = "+";
  }

  return `${prefix}${digits}€`;
};

/** Parses what a person types, like `12,50` or `1,918.16`, into cents. */
export const parseMoney = (input: string): Cents | null => {
  const cleaned = input.replaceAll(/[\s€]/gu, "");

  if (cleaned === "") {
    return null;
  }

  // The last separator followed by one or two digits is the decimal point.
  const decimal = /[.,](?<cents>\d{1,2})$/u.exec(cleaned);
  const whole = decimal ? cleaned.slice(0, decimal.index) : cleaned;
  const wholeDigits = whole.replaceAll(/[.,]/gu, "");

  if (!/^-?\d+$/u.test(wholeDigits)) {
    return null;
  }

  const fraction = decimal
    ? (decimal.groups?.cents ?? "").padEnd(2, "0")
    : "00";

  const negative = wholeDigits.startsWith("-");

  const value = Math.abs(Number(wholeDigits)) * 100 + Number(fraction);

  return negative ? -value : value;
};
