// Jedyne źródło bieżącego czasu dla aplikacji (STACK 5). Pozostałe funkcje
// czasu (`time.ts`) są czyste i przyjmują `now` z tego modułu.
//
// Podmiana zegara dla testów E2E nie może zależeć od `NODE_ENV`, bo E2E działa
// na buildzie produkcyjnym. Włącza ją jawna flaga `E2E_NOW` (moment w formacie
// akceptowanym przez `Date`). Każde środowisko Vercel (ustawione `VERCEL_ENV`)
// ignoruje flagę, więc podmiana nigdy nie zadziała na produkcji ani w podglądzie.

const CLOCK_OVERRIDE_ENV = "E2E_NOW";

/** Podmieniony moment z flagi testowej albo `null`, gdy flaga nie obowiązuje. */
export function clockOverride(): Date | null {
  if (process.env.VERCEL_ENV) return null;
  const raw = process.env[CLOCK_OVERRIDE_ENV];
  if (!raw) return null;
  const overridden = new Date(raw);
  return Number.isNaN(overridden.getTime()) ? null : overridden;
}

/** Bieżący moment: podmieniony flagą testową albo rzeczywisty czas systemowy. */
export function now(): Date {
  return clockOverride() ?? new Date();
}
