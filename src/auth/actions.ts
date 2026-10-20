"use server";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "./constants";
import { destroySession } from "./session";

/** Wylogowanie: unieważnia sesję w bazie, usuwa ciasteczko, wraca na logowanie. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect(LOGIN_PATH);
}
