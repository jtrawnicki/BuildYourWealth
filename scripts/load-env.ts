import { existsSync } from "node:fs";

/**
 * Skrypty administracyjne czytają tylko `.env` (nie `.env.local` ani
 * `.env.production*`), a zmienna ustawiona w powłoce ma pierwszeństwo.
 * Dzięki temu baza docelowa wynika wyłącznie z `DATABASE_URL` w powłoce
 * albo z `.env`.
 */
export function loadEnv(): void {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
}
