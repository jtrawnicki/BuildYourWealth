import "server-only";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "./constants";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Guard wołany w każdej stronie i Server Action (STACK 5, SPEC 12 scen. 13).
 * Bez ważnej sesji przekierowuje na logowanie zamiast zwrócić dane.
 *
 * Czyta ciasteczko sesji, więc jest dynamiczny: przy włączonym Cache Components
 * strona, która go woła, musi mieć granicę `<Suspense>` (tu daje ją
 * `loading.tsx` grupy `(app)`).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(LOGIN_PATH);
  }
  return user;
}
