import type { PasskeyStore } from "@ynabe/auth";
import { and, eq, gt, lte } from "drizzle-orm";
import { z } from "zod";

import type { Database } from "./budget.ts";
import { passkeyChallenges, passkeys, secondSteps } from "./schema.ts";

const transports = z.array(z.string());

/** Keeps passkeys, open passkey requests, and passed second steps in D1. */
export const passkeyStore = (db: Database): PasskeyStore => ({
  async addPasskey(email, passkey) {
    await db.insert(passkeys).values({
      counter: passkey.counter,
      email,
      id: passkey.id,
      publicKey: passkey.publicKey,
      transports: JSON.stringify(passkey.transports),
    });
  },
  async dropPass(hash) {
    await db.delete(secondSteps).where(eq(secondSteps.hash, hash));
  },
  async hasPass(hash, email, now) {
    const rows = await db
      .select({ hash: secondSteps.hash })
      .from(secondSteps)
      .where(
        and(
          eq(secondSteps.hash, hash),
          eq(secondSteps.email, email),
          gt(secondSteps.expiresAt, now)
        )
      );

    return rows.length > 0;
  },
  async passkeys(email) {
    const rows = await db
      .select()
      .from(passkeys)
      .where(eq(passkeys.email, email));

    return rows.map((row) => ({
      counter: row.counter,
      id: row.id,
      publicKey: row.publicKey,
      transports: transports.parse(JSON.parse(row.transports)),
    }));
  },
  async saveChallenge(email, challenge, expiresAt) {
    await db
      .insert(passkeyChallenges)
      .values({ challenge, email, expiresAt })
      .onConflictDoUpdate({
        set: { challenge, expiresAt },
        target: passkeyChallenges.email,
      });
  },
  async savePass(hash, email, expiresAt) {
    // Passes that ran out are of no use; clear them as new ones come in.
    await db.delete(secondSteps).where(lte(secondSteps.expiresAt, Date.now()));
    await db.insert(secondSteps).values({ email, expiresAt, hash });
  },
  async setCounter(id, counter) {
    await db.update(passkeys).set({ counter }).where(eq(passkeys.id, id));
  },
  async takeChallenge(email, now) {
    const rows = await db
      .delete(passkeyChallenges)
      .where(eq(passkeyChallenges.email, email))
      .returning();

    const [row] = rows;

    return row && row.expiresAt > now ? row.challenge : null;
  },
});
