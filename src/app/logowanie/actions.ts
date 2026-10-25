"use server";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  INVALID_CREDENTIALS_MESSAGE,
  LOCKED_MESSAGE,
  SESSION_COOKIE,
} from "@/auth/constants";
import { attemptLogin } from "@/auth/login";
import { createSession } from "@/auth/session";
import { hashToken } from "@/auth/token";
import { getDb } from "@/db/client";
import { createSandbox } from "@/db/demo";
import { normalizeEmail } from "@/db/users";
import { generateDemoData } from "@/demo/generate";
import { clientIp, hashIp, ipSecret } from "@/demo/ip";
import { isDemo } from "@/demo/mode";
import { now } from "@/domain/clock";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { field } from "@/app/form-data";
import { DEMO_MESSAGES, type DemoEntryState, type LoginState } from "./state";

// Czas życia piaskownicy demo: 24 h (SPEC 5.8).
const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // W demo nie ma logowania hasłem (SPEC 5.8): odrzucamy bez dotykania bazy.
  if (isDemo()) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }
  const email = normalizeEmail(field(formData, "email"));
  const password = field(formData, "password");
  if (!email || !password) {
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  let result;
  try {
    result = await attemptLogin(getDb(), email, password, new Date());
    if (result.ok) {
      await createSession(result.userId);
    }
  } catch (error) {
    // Błąd zapisu lub budzącej się bazy (SPEC 7): dane zostają w formularzu.
    console.error(SAVE_ERROR_MESSAGE, error);
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

/**
 * Wejście do wersji demo (SPEC 5.8): tworzy piaskownicę z danymi przykładowymi
 * i sesją, potem otwiera „Ten miesiąc". W trybie prywatnym nic nie robi (STACK 5).
 * Limity zwraca jako komunikat; sukces ustawia ciasteczko i przekierowuje.
 */
export async function enterDemo(
  _prev: DemoEntryState,
  _formData: FormData,
): Promise<DemoEntryState> {
  if (!isDemo()) return {};

  const token = randomBytes(32).toString("base64url");
  const current = now();
  let result;
  try {
    const forwardedFor = (await headers()).get("x-forwarded-for");
    const ipHash = hashIp(clientIp(forwardedFor), ipSecret(process.env));
    result = await createSandbox(getDb(), {
      ipHash,
      now: current,
      ttlMs: DEMO_TTL_MS,
      sessionId: hashToken(token),
      data: generateDemoData(current, Math.random),
    });
  } catch (error) {
    // Błąd zapisu, budzącej się bazy albo braku sekretu (SPEC 7, fail closed).
    console.error(SAVE_ERROR_MESSAGE, error);
    return { error: SAVE_ERROR_MESSAGE };
  }

  if (result.status === "too-many-ip")
    return { error: DEMO_MESSAGES.tooManyIp };
  if (result.status === "overloaded")
    return { error: DEMO_MESSAGES.overloaded };

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: result.expiresAt,
  });
  // redirect() rzuca, więc jest poza try.
  redirect("/");
}
