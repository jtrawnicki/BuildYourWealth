// Stan formularza planu podziału współdzielony przez Server Action i klienta.
// Formularz jest w całości sterowany po stronie klienta (dynamiczna lista
// celów), więc akcja nie odsyła wartości pól — zwraca tylko wynik zapisu.

export type PlanState = {
  saved?: boolean;
  saveFailed?: boolean;
  /** Odmowa zapisu z powodu reguły planu albo nieaktualnych danych. */
  formError?: string;
};

/** Pojedynczy cel w ładunku wysyłanym do akcji; wartości jak wpisane w polach. */
export type GoalDraft = {
  /** Istniejący cel ma `id`; nowy cel ma `null`. */
  id: number | null;
  pool: "savings" | "investments";
  name: string;
  pct: string;
  /** Id źródła jako tekst albo pusty, gdy nie wybrano. */
  sourceId: string;
  target: string;
  start: string;
  /** Termin `YYYY-MM`, pusty albo niepełny (`YYYY-` / `-MM`), gdy wybrano tylko część. */
  deadline: string;
};

export type PlanDraft = {
  savingsPct: string;
  investmentsPct: string;
  goals: GoalDraft[];
};

export const PLAN_MESSAGES = {
  invalid:
    "Plan ma błędy do poprawienia. Sprawdź procenty i pola celów, zanim zapiszesz.",
  stale: "Plan zmienił się w innym miejscu. Odśwież stronę i spróbuj ponownie.",
  sourceMissing: (name: string) =>
    `Źródło celu „${name}” jest już niedostępne. Odśwież stronę i wybierz inne źródło.`,
  currencyLocked: (name: string) =>
    `Waluty źródła celu „${name}” nie można zmienić, bo cel ma kwotę docelową, startową albo rozliczone wpłaty.`,
} as const;
