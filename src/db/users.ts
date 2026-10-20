import { eq, sql } from "drizzle-orm";
import { hashPassword } from "@/auth/password";
import type { getDb } from "./client";
import { sessions, settings, users } from "./schema";

type Db = ReturnType<typeof getDb>;

export const MIN_PASSWORD_LENGTH = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Tworzy konto albo ustawia nowe hasło istniejącemu (SPEC Z1). Zmiana hasła
 * unieważnia wszystkie sesje konta.
 */
export async function setUserPassword(
  db: Db,
  email: string,
  password: string,
): Promise<{ created: boolean }> {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) {
    throw new Error(`Niepoprawny adres e-mail: ${email}`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`,
    );
  }
  const passwordHash = await hashPassword(password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: normalized, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { passwordHash: sql`excluded.password_hash` },
      })
      .returning({ id: users.id, created: sql<boolean>`xmax = 0` });
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.insert(settings).values({ userId: user.id }).onConflictDoNothing();
    return { created: user.created };
  });
}
