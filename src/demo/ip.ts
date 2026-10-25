import "server-only";
import { createHmac } from "node:crypto";

// Skrót adresu IP do limitów demo (SPEC 5.8, STACK 5). W bazie trzymamy wyłącznie
// HMAC-SHA-256 adresu z sekretem `DEMO_IP_SECRET`, nigdy sam adres, żeby dane
// piaskownic nie zawierały informacji o odwiedzających.

/** Adres klienta z nagłówka `x-forwarded-for` (pierwszy wpis) albo `unknown`. */
export function clientIp(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}

/** HMAC-SHA-256 adresu IP; `secret` z `DEMO_IP_SECRET`. */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Sekret `DEMO_IP_SECRET`; brak to błąd konfiguracji (fail closed). */
export function ipSecret(env: Record<string, string | undefined>): string {
  const secret = env.DEMO_IP_SECRET;
  if (!secret) {
    throw new Error(
      "Brak DEMO_IP_SECRET: wymagany w trybie demo do skrótu adresu IP (STACK 5).",
    );
  }
  return secret;
}
