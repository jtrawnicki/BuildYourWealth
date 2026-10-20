import "server-only";
import { randomBytes } from "node:crypto";
import type { Db } from "@/db/client";
import { findUserByEmail } from "@/db/users";
import { hashPassword, verifyPassword } from "./password";
import {
  clearAttempts,
  getAttempt,
  isLocked,
  recordFailure,
} from "./login-attempts";

export type LoginResult =
  { ok: true; userId: number } | { ok: false; reason: "locked" | "invalid" };

// Hash-wabik do weryfikacji przy nieistniejącym koncie, żeby czas odpowiedzi
// nie zdradzał, czy adres istnieje. Liczony raz i buforowany.
let decoy: Promise<string> | undefined;
function decoyHash(): Promise<string> {
  return (decoy ??= hashPassword(randomBytes(18).toString("hex")));
}

/**
 * Sprawdza dane logowania z ochroną przed zgadywaniem hasła (STACK 5):
 * blokada per adres (także nieistniejący), weryfikacja hasła w stałym czasie
 * i wabik przy braku konta. Nie dotyka ciasteczek — sesję tworzy wołający.
 */
export async function attemptLogin(
  db: Db,
  email: string,
  password: string,
  now: Date,
): Promise<LoginResult> {
  if (isLocked(await getAttempt(db, email), now)) {
    return { ok: false, reason: "locked" };
  }
  const user = await findUserByEmail(db, email);
  const valid = await verifyPassword(
    password,
    user?.passwordHash ?? (await decoyHash()),
  );
  if (!user || !valid) {
    await recordFailure(db, email, now);
    return { ok: false, reason: "invalid" };
  }
  await clearAttempts(db, email);
  return { ok: true, userId: user.id };
}
