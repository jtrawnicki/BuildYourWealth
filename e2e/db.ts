import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { hashPassword } from "@/auth/password";
import { hashToken } from "@/auth/token";
import { getDb } from "@/db/client";
import { sessions, settings, users } from "@/db/schema";

// Infrastruktura danych E2E (T3): czyszczenie bazy, konto testowe i sesja
// zakładana wprost w bazie, żeby fixture logowania był szybki i deterministyczny.
// Działa przez warstwę `db/`, więc późniejsze zadania seedują przez te same tory.

export const TEST_EMAIL = "test@example.com";
export const TEST_PASSWORD = "haslo-testowe-123";

/** Usuwa wszystkie dane; `restart identity` zeruje liczniki id między testami. */
export async function resetDatabase(): Promise<void> {
  await getDb().execute(
    sql`truncate table users, sessions, settings, sources, goals, months, month_goals, incomes, login_attempts restart identity cascade`,
  );
}

export async function createTestUser(
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
): Promise<number> {
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword(password) })
    .returning({ id: users.id });
  await db.insert(settings).values({ userId: user.id });
  return user.id;
}

/** Zakłada sesję w bazie i zwraca token do ustawienia w ciasteczku przeglądarki. */
export async function createSessionToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getDb()
    .insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
  return token;
}
