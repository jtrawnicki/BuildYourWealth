"use server";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { isDemo } from "@/demo/mode";
import { LOGIN_PATH } from "./constants";
import { destroySession, getSessionUser } from "./session";

/**
 * Wylogowanie: unieważnia sesję w bazie, usuwa ciasteczko, wraca na logowanie.
 * W trybie demo „Wyloguj" kończy piaskownicę od razu (SPEC 5.8): usuwa konto
 * demo, co kaskadowo kasuje jego dane i pozostałe sesje.
 */
export async function logout(): Promise<void> {
  const demoUser = isDemo() ? await getSessionUser() : null;
  await destroySession();
  if (demoUser) {
    await getDb().delete(users).where(eq(users.id, demoUser.id));
  }
  redirect(LOGIN_PATH);
}
