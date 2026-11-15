import { Database as Sqlite } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { passkeyStore } from "../src/index.ts";
import * as schema from "../src/schema.ts";

const ME = "me@example.com";

const open = () => {
  const db = drizzle(new Sqlite(":memory:"), { schema });

  migrate(db, { migrationsFolder: `${import.meta.dir}/../migrations` });

  return passkeyStore(db);
};

describe("passkeyStore", () => {
  test("keeps an account's passkeys and their use count", async () => {
    const store = open();

    await store.addPasskey(ME, {
      counter: 0,
      id: "one",
      publicKey: "key",
      transports: ["internal", "hybrid"],
    });
    await store.setCounter("one", 7);

    expect(await store.passkeys(ME)).toEqual([
      {
        counter: 7,
        id: "one",
        publicKey: "key",
        transports: ["internal", "hybrid"],
      },
    ]);
    expect(await store.passkeys("other@example.com")).toEqual([]);
  });

  test("hands out a request once, and only the latest, before it runs out", async () => {
    const store = open();

    await store.saveChallenge(ME, "first", 1000);
    await store.saveChallenge(ME, "second", 1000);

    expect(await store.takeChallenge(ME, 500)).toBe("second");
    expect(await store.takeChallenge(ME, 500)).toBeNull();

    await store.saveChallenge(ME, "late", 1000);

    expect(await store.takeChallenge(ME, 1000)).toBeNull();
  });

  test("knows a passed step by its hash, its account, and its time", async () => {
    const store = open();
    const until = Date.now() + 60_000;

    await store.savePass("hash", ME, until);

    expect(await store.hasPass("hash", ME, until - 1)).toBe(true);
    expect(await store.hasPass("hash", ME, until)).toBe(false);
    expect(await store.hasPass("hash", "other@example.com", 0)).toBe(false);
    expect(await store.hasPass("other", ME, 0)).toBe(false);

    await store.dropPass("hash");

    expect(await store.hasPass("hash", ME, 0)).toBe(false);
  });
});
