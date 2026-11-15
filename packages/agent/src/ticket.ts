const encoder = new TextEncoder();

const keyFor = (secret: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(`ynabe-agent:${secret}`),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"]
  );

const toHex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (text: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(text.match(/[\da-f]{2}/gu) ?? [], (pair) =>
    Number.parseInt(pair, 16)
  );

/**
 * A pass for one run of the assistant: it lets the runner call the
 * tools for that run, until `expires` (milliseconds since 1970).
 */
export const writeTicket = async (
  secret: string,
  run: string,
  expires: number
): Promise<string> => {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await keyFor(secret),
    encoder.encode(`${run}.${expires}`)
  );

  return `${run}.${expires}.${toHex(signature)}`;
};

/** The run a ticket is for, or null when it is forged or has expired. */
export const readTicket = async (
  secret: string,
  ticket: string,
  now: number
): Promise<string | null> => {
  const [run, expires, signature] = ticket.split(".");

  if (!run || !expires || !signature || Number(expires) < now) {
    return null;
  }

  const genuine = await crypto.subtle.verify(
    "HMAC",
    await keyFor(secret),
    fromHex(signature),
    encoder.encode(`${run}.${expires}`)
  );

  return genuine ? run : null;
};
