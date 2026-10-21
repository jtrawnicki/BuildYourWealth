import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { isDemo } from "@/demo/mode";
import { SESSION_COOKIE, SESSION_TTL_MS } from "./constants";
import {
  deleteSession,
  storeSession,
  userForToken,
  type SessionUser,
} from "./session-store";

export type { SessionUser };

/** Tworzy sesję: losowy token w ciasteczku, w bazie tylko jego skrót (STACK 5). */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await storeSession(getDb(), token, userId, expiresAt);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Użytkownik bieżącej sesji z ciasteczka albo `null`. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return userForToken(getDb(), token, isDemo());
}

/** Unieważnia sesję w bazie i usuwa ciasteczko. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) {
    return;
  }
  await deleteSession(getDb(), token);
  store.delete(SESSION_COOKIE);
}
