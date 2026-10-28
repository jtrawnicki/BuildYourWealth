import { parseEnv } from "node:util";

// Konfiguracja wersji prywatnej (STACK 5 „Wersja prywatna”). Plik `.env.private`
// czytają wyłącznie skrypty `npm run private:*` (`scripts/private.ts`).

export const PRIVATE_ENV_FILE = ".env.private";
export const PRIVATE_DIST_DIR = ".next-private";
export const PRIVATE_HOST = "127.0.0.1";
export const PRIVATE_PORT = 4000;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

type Env = Record<string, string | undefined>;

export type PrivateDatabase = { url: string; name: string; user: string };

/**
 * Adres bazy wersji prywatnej z treści `.env.private`. Baza musi być na tym
 * komputerze (SPEC 10), a jej nazwa prosta, bo trafia do poleceń Postgresa.
 */
export function parsePrivateDatabase(content: string): PrivateDatabase {
  const raw = parseEnv(content).DATABASE_URL;
  if (!raw) {
    throw new Error(`Brak DATABASE_URL w ${PRIVATE_ENV_FILE}.`);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`DATABASE_URL w ${PRIVATE_ENV_FILE} nie jest adresem URL.`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(
      `Baza wersji prywatnej musi działać na tym komputerze (localhost), a nie na ${url.hostname}.`,
    );
  }
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(
      `Nazwa bazy w ${PRIVATE_ENV_FILE} może zawierać tylko a-z, 0-9 i _.`,
    );
  }
  if (name.endsWith("_test")) {
    throw new Error(
      "Baza wersji prywatnej nie może kończyć się na _test: testy ją czyszczą.",
    );
  }
  const user = decodeURIComponent(url.username);
  if (!user) {
    throw new Error(
      `Podaj użytkownika bazy w DATABASE_URL w ${PRIVATE_ENV_FILE}.`,
    );
  }
  return { url: raw, name, user };
}

/** Zmienne dla procesów wersji prywatnej: jej baza, tryb i katalog buildu. */
export function privateProcessEnv(base: Env, db: PrivateDatabase): Env {
  const env: Env = {
    ...base,
    DATABASE_URL: db.url,
    APP_MODE: "private",
    BYW_DIST_DIR: PRIVATE_DIST_DIR,
    // Pusta wartość, nie brak: Next nie nadpisze jej adresem atrapy NBP z `.env`.
    NBP_API_URL: "",
  };
  // drizzle.config.ts woli adres bezpośredni; tu nie może wskazać innej bazy.
  delete env.DATABASE_URL_UNPOOLED;
  return env;
}
