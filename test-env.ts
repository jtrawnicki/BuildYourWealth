import { loadEnvConfig } from "@next/env";

/**
 * Ładuje zmienne tak jak Next.js w trybie testowym: `.env.test.local`,
 * `.env.test`, `.env` (bez `.env.local`). Zmienne ustawione w powłoce,
 * np. `DATABASE_URL` w CI, mają pierwszeństwo.
 */
export function loadTestEnv(): void {
  const env = process.env as Record<string, string | undefined>;
  const nodeEnv = env.NODE_ENV;
  env.NODE_ENV = "test";
  loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });
  if (nodeEnv === undefined) {
    delete env.NODE_ENV;
  } else {
    env.NODE_ENV = nodeEnv;
  }
}
