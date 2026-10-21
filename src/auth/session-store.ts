import "server-only";
import { and, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { hashToken } from "./token";

export type SessionUser = { id: number; email: string };

export async function storeSession(
  db: Db,
  token: string,
  userId: number,
  expiresAt: Date,
): Promise<void> {
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
}

/**
 * Użytkownik ważnej sesji o danym tokenie albo `null`. Termin ważności
 * porównujemy z zegarem bazy (`now()`), więc odczyt sesji w renderze strony nie
 * wprowadza niestabilnej wartości `new Date()` (Cache Components).
 */
export async function userForToken(
  db: Db,
  token: string,
  demo: boolean,
): Promise<SessionUser | null> {
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, hashToken(token)),
        gt(sessions.expiresAt, sql`now()`),
        // Tryb demo wpuszcza tylko konta demo, a prywatny tylko zwykłe
        // (STACK 5 „Tryby aplikacji”).
        demo ? isNotNull(users.demoExpiresAt) : isNull(users.demoExpiresAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
