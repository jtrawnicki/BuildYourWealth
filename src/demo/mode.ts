// Tryb aplikacji (STACK 5 „Tryby aplikacji”): ten sam kod działa jako wersja
// prywatna albo demo. Reszta kodu pyta ten moduł, zamiast czytać `APP_MODE`.
//
// Każde środowisko Vercel (ustawione `VERCEL_ENV`) wymaga trybu demo, żeby
// pomyłka w zmiennych nie wystawiła do internetu logowania hasłem.

export type AppMode = "private" | "demo";

type Env = Record<string, string | undefined>;

/** Tryb wynikający ze zmiennych środowiskowych; zgłasza błąd przy niedozwolonym. */
export function resolveAppMode(env: Env): AppMode {
  const raw = env.APP_MODE || "private";
  if (raw !== "private" && raw !== "demo") {
    throw new Error(
      `Nieznany tryb aplikacji APP_MODE=${raw}; dozwolone: private, demo.`,
    );
  }
  if (env.VERCEL_ENV && raw !== "demo") {
    throw new Error(
      "Na Vercel aplikacja działa tylko w trybie demo: ustaw APP_MODE=demo (STACK 5).",
    );
  }
  return raw;
}

/** Tryb bieżącego procesu. */
export function appMode(): AppMode {
  return resolveAppMode(process.env);
}

export function isDemo(): boolean {
  return appMode() === "demo";
}
