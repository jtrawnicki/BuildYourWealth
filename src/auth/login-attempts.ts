import "server-only";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { loginAttempts } from "@/db/schema";
import { LOCK_DURATION_MS, MAX_FAILED_ATTEMPTS } from "./constants";

export type AttemptRecord = { failedCount: number; lockedUntil: Date | null };

/** Czy adres jest zablokowany w danej chwili. */
export function isLocked(
  record: AttemptRecord | undefined,
  now: Date,
): boolean {
  return (
    record?.lockedUntil != null && record.lockedUntil.getTime() > now.getTime()
  );
}

/**
 * Stan licznika po nieudanej próbie. Wołany tylko, gdy adres nie jest aktualnie
 * zablokowany (wygasłą blokadę traktuje jako nowy początek liczenia).
 */
export function nextAfterFailure(
  record: AttemptRecord | undefined,
  now: Date,
): AttemptRecord {
  const expired =
    record?.lockedUntil != null &&
    record.lockedUntil.getTime() <= now.getTime();
  const failedCount = (expired || !record ? 0 : record.failedCount) + 1;
  const lockedUntil =
    failedCount >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + LOCK_DURATION_MS)
      : null;
  return { failedCount, lockedUntil };
}

export async function getAttempt(
  db: Db,
  email: string,
): Promise<AttemptRecord | undefined> {
  const [row] = await db
    .select({
      failedCount: loginAttempts.failedCount,
      lockedUntil: loginAttempts.lockedUntil,
    })
    .from(loginAttempts)
    .where(eq(loginAttempts.email, email))
    .limit(1);
  return row;
}

export async function recordFailure(
  db: Db,
  email: string,
  now: Date,
): Promise<AttemptRecord> {
  const next = nextAfterFailure(await getAttempt(db, email), now);
  await db
    .insert(loginAttempts)
    .values({
      email,
      failedCount: next.failedCount,
      lockedUntil: next.lockedUntil,
    })
    .onConflictDoUpdate({
      target: loginAttempts.email,
      set: { failedCount: next.failedCount, lockedUntil: next.lockedUntil },
    });
  return next;
}

/** Zeruje licznik po udanym logowaniu. */
export async function clearAttempts(db: Db, email: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.email, email));
}
