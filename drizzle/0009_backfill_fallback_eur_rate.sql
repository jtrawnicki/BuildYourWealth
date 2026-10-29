-- Dawny ręczny kurs EUR→PLN staje się kursem zapasowym (SPEC 5.9, T19b).
-- Od Etapu 2 bieżący kurs pochodzi z NBP, a ustawienie `eur_rate` zastępuje
-- `fallback_eur_rate`. Przepisujemy wartość tam, gdzie kursu zapasowego jeszcze
-- nie ma, a `eur_rate` był ustawiony. Migracja jest dodająca i zgodna wstecz:
-- kolumny `eur_rate` nie usuwamy, więc poprzednie wdrożenie dalej działa.
UPDATE "settings"
SET "fallback_eur_rate" = "eur_rate"
WHERE "fallback_eur_rate" IS NULL
  AND "eur_rate" IS NOT NULL;
