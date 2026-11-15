import { describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";

import { createSecondStep } from "../src/server.ts";
import type { PasskeyStore, StoredPasskey } from "../src/server.ts";

const BASE = "https://app.example";
const ME = "me@example.com";
const DAY = 24 * 60 * 60 * 1000;

/** A store that lives in memory, with the same rules as the real one. */
const memory = (): PasskeyStore => {
  const passkeys = new Map<string, StoredPasskey & { email: string }>();
  const challenges = new Map<string, { challenge: string; until: number }>();
  const passes = new Map<string, { email: string; until: number }>();

  return {
    addPasskey(email, passkey) {
      passkeys.set(passkey.id, { ...passkey, email });

      return Promise.resolve();
    },
    dropPass(hash) {
      passes.delete(hash);

      return Promise.resolve();
    },
    hasPass(hash, email, now) {
      const pass = passes.get(hash);

      return Promise.resolve(
        pass !== undefined && pass.email === email && pass.until > now
      );
    },
    passkeys(email) {
      return Promise.resolve(
        [...passkeys.values()].filter((passkey) => passkey.email === email)
      );
    },
    saveChallenge(email, challenge, until) {
      challenges.set(email, { challenge, until });

      return Promise.resolve();
    },
    savePass(hash, email, until) {
      passes.set(hash, { email, until });

      return Promise.resolve();
    },
    setCounter(id, counter) {
      const passkey = passkeys.get(id);

      if (passkey) {
        passkeys.set(id, { ...passkey, counter });
      }

      return Promise.resolve();
    },
    takeChallenge(email, now) {
      const open = challenges.get(email);

      challenges.delete(email);

      return Promise.resolve(open && open.until > now ? open.challenge : null);
    },
  };
};

const sha256 = (data: Uint8Array | string) =>
  createHash("sha256").update(data).digest();

const encode = (data: Uint8Array | string) =>
  Buffer.from(data).toString("base64url");

const clientData = (type: string, challenge: string, origin: string) =>
  JSON.stringify({ challenge, crossOrigin: false, origin, type });

// Present and verified, with a zero use count.
const head = (flags: number) =>
  Buffer.concat([sha256("app.example"), Buffer.from([flags, 0, 0, 0, 0])]);

/** A passkey held in software, standing in for a password manager. */
const authenticator = (id = "passkey-one") => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = Buffer.from(id);

  // The public key as a COSE map: EC2, ES256, P-256, x, y.
  const cose = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    Buffer.from(jwk.x ?? "", "base64url"),
    Buffer.from([0x22, 0x58, 0x20]),
    Buffer.from(jwk.y ?? "", "base64url"),
  ]);

  const answer = { clientExtensionResults: {}, type: "public-key" };

  return {
    create(challenge: string, origin = BASE) {
      const authData = Buffer.concat([
        head(0x45),
        Buffer.alloc(16),
        Buffer.from([0, credentialId.length]),
        credentialId,
        cose,
      ]);

      // {"fmt": "none", "attStmt": {}, "authData": bytes} in CBOR.
      const attestation = Buffer.concat([
        Buffer.from([0xa3, 0x63]),
        Buffer.from("fmt"),
        Buffer.from([0x64]),
        Buffer.from("none"),
        Buffer.from([0x67]),
        Buffer.from("attStmt"),
        Buffer.from([0xa0, 0x68]),
        Buffer.from("authData"),
        Buffer.from([0x58, authData.length]),
        authData,
      ]);

      return {
        ...answer,
        id: encode(credentialId),
        rawId: encode(credentialId),
        response: {
          attestationObject: encode(attestation),
          clientDataJSON: encode(
            clientData("webauthn.create", challenge, origin)
          ),
        },
      };
    },
    show(challenge: string, key: KeyObject = privateKey) {
      const authData = head(0x05);
      const client = clientData("webauthn.get", challenge, BASE);

      return {
        ...answer,
        id: encode(credentialId),
        rawId: encode(credentialId),
        response: {
          authenticatorData: encode(authData),
          clientDataJSON: encode(client),
          signature: encode(
            sign("sha256", Buffer.concat([authData, sha256(client)]), key)
          ),
        },
      };
    },
  };
};

const post = (step: string, body = "{}", cookie = "", origin = BASE) =>
  new Request(`${BASE}/api/passkey/${step}`, {
    body,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: origin,
    },
    method: "POST",
  });

type Passkey = ReturnType<typeof authenticator>;

type Answer = ReturnType<Passkey["create"] | Passkey["show"]>;

/** The step with a clock the test can move, and one account using it. */
const setup = () => {
  let time = 1_800_000_000_000;

  const step = createSecondStep({
    baseUrl: BASE,
    now: () => time,
    store: memory(),
  });

  const challenge = async (email: string | null = ME) => {
    const response = await step.handle(post("challenge"), email);

    const body: { kind: string; options: { challenge: string } } =
      await response?.json();

    return body;
  };

  /** Sends an answer; returns the status and the cookie it set, if any. */
  const answer = async (body: Answer) => {
    const response = await step.handle(
      post("answer", JSON.stringify(body)),
      ME
    );

    const cookie = response?.headers.get("Set-Cookie")?.split(";")[0] ?? "";

    return { cookie, status: response?.status };
  };

  const status = (cookie = "") =>
    step.status(new Request(BASE, { headers: { Cookie: cookie } }), ME);

  return {
    answer,
    challenge,
    status,
    step,
    wait: (ms: number) => {
      time += ms;
    },
  };
};

/** An account that has created its passkey in one browser. */
const enrolled = async () => {
  const app = setup();
  const passkey = authenticator();
  const { options } = await app.challenge();
  const { cookie } = await app.answer(passkey.create(options.challenge));

  return { ...app, cookie, passkey };
};

describe("the passkey step", () => {
  test("starts with creating the first passkey, which lets that browser in", async () => {
    const app = setup();

    expect(await app.status()).toBe("setup");

    const asked = await app.challenge();

    expect(asked.kind).toBe("create");

    const { cookie, status } = await app.answer(
      authenticator().create(asked.options.challenge)
    );

    expect(status).toBe(200);
    expect(cookie).toStartWith("__Secure-ynabe.second-step=");
    expect(await app.status(cookie)).toBe("passed");
  });

  test("asks another browser to show the passkey, and lets it in when it does", async () => {
    const app = await enrolled();

    expect(await app.status()).toBe("needed");

    const asked = await app.challenge();

    expect(asked.kind).toBe("verify");

    const { cookie, status } = await app.answer(
      app.passkey.show(asked.options.challenge)
    );

    expect(status).toBe(200);
    expect(await app.status(cookie)).toBe("passed");
  });

  test("refuses a passkey it does not know", async () => {
    const app = await enrolled();
    const { options } = await app.challenge();
    const stranger = generateKeyPairSync("ec", { namedCurve: "P-256" });

    const forged = await app.answer(
      app.passkey.show(options.challenge, stranger.privateKey)
    );

    expect(forged.status).toBe(400);
    expect(forged.cookie).toBe("");

    const again = await app.challenge();

    const other = await app.answer(
      authenticator("passkey-two").show(again.options.challenge)
    );

    expect(other.status).toBe(400);
  });

  test("does not let a second passkey be created by Google sign-in alone", async () => {
    const app = await enrolled();
    const { options } = await app.challenge();

    const { status } = await app.answer(
      authenticator("passkey-two").create(options.challenge)
    );

    expect(status).toBe(400);
    expect(await app.status()).toBe("needed");
  });

  test("accepts each request once, and only for a few minutes", async () => {
    const app = await enrolled();
    const first = await app.challenge();
    const shown = app.passkey.show(first.options.challenge);

    const once = await app.answer(shown);
    const twice = await app.answer(shown);

    expect(once.status).toBe(200);
    expect(twice.status).toBe(400);

    const late = await app.challenge();

    app.wait(6 * 60 * 1000);

    const tooLate = await app.answer(app.passkey.show(late.options.challenge));

    expect(tooLate.status).toBe(400);
  });

  test("refuses a passkey made for another site", async () => {
    const app = setup();
    const { options } = await app.challenge();

    const { status } = await app.answer(
      authenticator().create(options.challenge, "https://evil.example")
    );

    expect(status).toBe(400);
    expect(await app.status()).toBe("setup");
  });

  test("ends after thirty days, and when the browser leaves", async () => {
    const app = await enrolled();

    app.wait(29 * DAY);

    expect(await app.status(app.cookie)).toBe("passed");

    const left = await app.step.handle(post("leave", "{}", app.cookie), ME);

    expect(left?.status).toBe(200);
    expect(await app.status(app.cookie)).toBe("needed");

    const next = await enrolled();

    next.wait(31 * DAY);

    expect(await next.status(next.cookie)).toBe("needed");
  });

  test("does not let one account's pass open another account", async () => {
    const app = await enrolled();

    expect(
      await app.step.status(
        new Request(BASE, { headers: { Cookie: app.cookie } }),
        "other@example.com"
      )
    ).toBe("setup");
  });

  test("answers only this app's own pages, after Google sign-in", async () => {
    const { step } = setup();

    const elsewhere = await step.handle(
      post("challenge", "{}", "", "https://evil.example"),
      ME
    );

    const reading = await step.handle(
      new Request(`${BASE}/api/passkey/challenge`, {
        headers: { Origin: BASE },
      }),
      ME
    );

    const signedOut = await step.handle(post("challenge"), null);

    expect(elsewhere?.status).toBe(403);
    expect(reading?.status).toBe(403);
    expect(signedOut?.status).toBe(401);
    expect(await step.handle(new Request(`${BASE}/plan`), ME)).toBeUndefined();
  });
});
