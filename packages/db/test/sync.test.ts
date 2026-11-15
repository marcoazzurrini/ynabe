import { Database as Sqlite } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

import { syncBanks, synciFeed } from "../src/index.ts";
import * as schema from "../src/schema.ts";

const open = async () => {
  const db = drizzle(new Sqlite(":memory:"), { schema });

  migrate(db, { migrationsFolder: `${import.meta.dir}/../migrations` });

  await db.insert(schema.accounts).values([
    { id: "bank", name: "Bank" },
    { id: "card", name: "Card" },
  ]);
  await db.insert(schema.bankLinks).values([
    { accountId: "bank", since: "2025-03-01", sourceId: "100" },
    { accountId: "card", since: "2025-03-01", sourceId: "200" },
  ]);

  return db;
};

const row = (id: string, date: string, amount: number, words: string) => ({
  amount,
  booked: true,
  date,
  description: words,
  id,
  payee: words,
});

/** A feed that gives the bank account these rows and the card none. */
const bankSends =
  (...rows: ReturnType<typeof row>[]) =>
  ({ accountId }: { accountId: string }) =>
    Promise.resolve(accountId === "bank" ? rows : []);

describe("syncBanks", () => {
  test("adds new rows once, however often it runs", async () => {
    const db = await open();
    const feed = bankSends(row("900", "2025-03-04", -1250, "Corner Bakery"));

    expect(await syncBanks(db, feed)).toMatchObject({ added: 1, claimed: 0 });
    expect(await syncBanks(db, feed)).toMatchObject({ added: 0, claimed: 0 });

    const stored = await db.select().from(schema.transactions);

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      accountId: "bank",
      amount: -1250,
      id: "bank-900",
      payee: "Corner Bakery",
      sourceId: "900",
    });
  });

  test("ties a statement row to its bank row and adds no copy", async () => {
    const db = await open();

    await db.insert(schema.transactions).values({
      accountId: "bank",
      amount: -1250,
      date: "2025-03-03",
      id: "from-statement",
      payee: "Corner Bakery",
    });

    const report = await syncBanks(
      db,
      bankSends(row("900", "2025-03-04", -1250, "Corner Bakery"))
    );

    const stored = await db.select().from(schema.transactions);

    expect(report).toMatchObject({ added: 0, claimed: 1 });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.sourceId).toBe("900");
  });

  test("joins the two sides of a transfer between linked accounts", async () => {
    const db = await open();
    const topUp = { accountId: "bank", cleared: "cleared" as const };

    await db.insert(schema.transactions).values([
      {
        ...topUp,
        amount: -5000,
        date: "2025-01-04",
        id: "a",
        memo: "TOP UP",
        payee: "Transfer to Card",
        transferAccountId: "card",
      },
      {
        ...topUp,
        amount: -5000,
        date: "2025-02-04",
        id: "b",
        memo: "TOP UP",
        payee: "Transfer to Card",
        transferAccountId: "card",
      },
    ]);

    await syncBanks(db, ({ accountId }) =>
      Promise.resolve(
        accountId === "bank"
          ? [row("900", "2025-03-04", -5000, "TOP UP")]
          : [row("901", "2025-03-05", 5000, "Money added")]
      )
    );

    const stored = await db.select().from(schema.transactions);
    const side = (id: string) => stored.find((found) => found.id === id);

    expect(side("bank-900")?.transferAccountId).toBe("card");
    expect(side("bank-901")).toMatchObject({
      payee: "Transfer from Bank",
      transferAccountId: "bank",
    });
  });
});

describe("pending payments", () => {
  const coffee = row("900", "2025-03-04", -500, "Coffee Cart");

  test("clear when the bank books them", async () => {
    const db = await open();

    await syncBanks(db, bankSends({ ...coffee, booked: false }));

    const report = await syncBanks(db, bankSends({ ...coffee, amount: -520 }));
    const stored = await db.select().from(schema.transactions);

    expect(report).toMatchObject({ added: 0, removed: 0, settled: 1 });
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ amount: -520, cleared: "cleared" });
  });

  test("are removed when the bank drops them", async () => {
    const db = await open();

    await syncBanks(db, bankSends({ ...coffee, booked: false }));

    const report = await syncBanks(
      db,
      bankSends(row("950", "2025-03-03", -1250, "Corner Bakery"))
    );

    const stored = await db.select().from(schema.transactions);

    expect(report).toMatchObject({ added: 1, removed: 1 });
    expect(stored.map(({ id }) => id)).toEqual(["bank-950"]);
  });
});

const link = { accountId: "bank", since: "2025-03-01", sourceId: "100" };

const answer = (status: number, body: string) =>
  Promise.resolve({
    ok: status === 200,
    status,
    text: () => Promise.resolve(body),
  });

describe("synciFeed", () => {
  test("reads every page and sends the token", async () => {
    const asked: { page: string | null; token: string | undefined }[] = [];

    const rows = await synciFeed("secret", (url, { headers }) => {
      const page = new URL(url).searchParams.get("page[number]");

      asked.push({ page, token: headers.Authorization });

      return answer(
        200,
        JSON.stringify({
          data: [
            {
              amount: "-1.00",
              booked: true,
              booking_date: "2025-03-04",
              currency: "EUR",
              id: Number(page),
              mapped_fields: { description: "Shop", payee: "Shop" },
            },
          ],
          meta: { last_page: 2 },
        })
      );
    })(link);

    expect(rows.map(({ id }) => id)).toEqual(["1", "2"]);
    expect(asked).toEqual([
      { page: "1", token: "Bearer secret" },
      { page: "2", token: "Bearer secret" },
    ]);
  });

  test("reports the status only when Synci refuses", () => {
    const feed = synciFeed("secret", () => answer(401, "private"));

    expect(feed(link)).rejects.toThrow("Synci answered 401");
  });
});
