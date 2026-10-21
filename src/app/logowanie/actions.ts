"use server";
import { redirect } from "next/navigation";
import { attemptLogin } from "@/auth/login";
import { INVALID_CREDENTIALS_MESSAGE, LOCKED_MESSAGE } from "@/auth/constants";
import { createSession } from "@/auth/session";
import { getDb } from "@/db/client";
import { normalizeEmail } from "@/db/users";
import { isDemo } from "@/demo/mode";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import type { LoginState } from "./state";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // W demo nie ma logowania hasłem (SPEC 5.8): odrzucamy bez dotykania bazy.
  if (isDemo()) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  let result;
  try {
    result = await attemptLogin(getDb(), email, password, new Date());
    if (result.ok) {
      await createSession(result.userId);
    }
  } catch {
    // Błąd zapisu lub budzącej się bazy (SPEC 7): dane zostają w formularzu.
    return { error: SAVE_ERROR_MESSAGE };
  }

  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? LOCKED_MESSAGE
          : INVALID_CREDENTIALS_MESSAGE,
    };
  }
  // redirect() rzuca, więc jest poza try, by nie trafić do obsługi błędu.
  redirect("/");
}
