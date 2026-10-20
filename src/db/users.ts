import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { sessions, settings, users } from "./schema";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Tworzy konto albo ustawia nowe hasło istniejącemu kontu o tym adresie.
 * Zmiana hasła unieważnia wszystkie sesje konta.
 */
export async function setUserPassword(
  db: Db,
  email: string,
  passwordHash: string,
): Promise<{ userId: number; created: boolean }> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: normalizeEmail(email), passwordHash })
      .onConflictDoUpdate({ target: users.email, set: { passwordHash } })
      .returning({ id: users.id, created: sql<boolean>`xmax = 0` });
    await tx.insert(settings).values({ userId: user.id }).onConflictDoNothing();
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    return { userId: user.id, created: user.created };
  });
}
