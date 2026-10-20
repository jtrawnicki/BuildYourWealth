import { createHash } from "node:crypto";

// Osobny moduł bez `server-only`: skrót tokenu jest potrzebny też w infrastrukturze
// testów E2E (seedowanie sesji), która działa poza bundlem serwerowym Next.

/** Skrót tokenu sesji trzymany w bazie; samego tokenu nie zapisujemy (STACK 5). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
