import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closePool, getDb } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import { LOCK_DURATION_MS, MAX_FAILED_ATTEMPTS } from "./constants";
import {
  clearAttempts,
  getAttempt,
  isLocked,
  nextAfterFailure,
  recordFailure,
} from "./login-attempts";

afterAll(closePool);

describe("logika licznika prób", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  it("nie jest zablokowany bez rekordu i bez terminu blokady", () => {
    expect(isLocked(undefined, now)).toBe(false);
    expect(isLocked({ failedCount: 3, lockedUntil: null }, now)).toBe(false);
  });

  it("jest zablokowany, gdy termin blokady jest w przyszłości", () => {
    const future = new Date(now.getTime() + 1000);
    const past = new Date(now.getTime() - 1000);
    expect(isLocked({ failedCount: 5, lockedUntil: future }, now)).toBe(true);
    expect(isLocked({ failedCount: 5, lockedUntil: past }, now)).toBe(false);
  });

  it("liczy próby i blokuje dopiero po osiągnięciu limitu", () => {
    let record = nextAfterFailure(undefined, now);
    expect(record).toEqual({ failedCount: 1, lockedUntil: null });
    for (let i = 2; i < MAX_FAILED_ATTEMPTS; i++) {
      record = nextAfterFailure(record, now);
      expect(record.failedCount).toBe(i);
      expect(record.lockedUntil).toBeNull();
    }
    record = nextAfterFailure(record, now);
    expect(record.failedCount).toBe(MAX_FAILED_ATTEMPTS);
    expect(record.lockedUntil).toEqual(
      new Date(now.getTime() + LOCK_DURATION_MS),
    );
  });

  it("wygasła blokada zaczyna liczenie od nowa", () => {
    const expired = {
      failedCount: MAX_FAILED_ATTEMPTS,
      lockedUntil: new Date(now.getTime() - 1),
    };
    expect(nextAfterFailure(expired, now)).toEqual({
      failedCount: 1,
      lockedUntil: null,
    });
  });
});

describe("licznik prób w bazie", () => {
  const emails: string[] = [];
  function freshEmail(): string {
    const email = `limit_${randomBytes(4).toString("hex")}@example.com`;
    emails.push(email);
    return email;
  }

  afterEach(async () => {
    const db = getDb();
    for (const email of emails.splice(0)) {
      await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
    }
  });

  it("zapisuje i zeruje licznik, także dla nieistniejącego adresu", async () => {
    const db = getDb();
    const email = freshEmail();
    const now = new Date();

    await recordFailure(db, email, now);
    await recordFailure(db, email, now);
    expect((await getAttempt(db, email))?.failedCount).toBe(2);

    await clearAttempts(db, email);
    expect(await getAttempt(db, email)).toBeUndefined();
  });

  it("blokuje adres po przekroczeniu limitu", async () => {
    const db = getDb();
    const email = freshEmail();
    const now = new Date();

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      await recordFailure(db, email, now);
    }
    expect(isLocked(await getAttempt(db, email), now)).toBe(false);

    await recordFailure(db, email, now);
    expect(isLocked(await getAttempt(db, email), now)).toBe(true);
  });
});
