// Stan formularza rozliczenia współdzielony przez Server Action i klienta.
// Formularz jest sterowany po stronie klienta (wybór opcji, pola kwot), więc
// akcja zwraca tylko wynik zapisu: błędy pól (klucz = id celu) albo komunikat.

export type SettleState = {
  /** Błędy pól faktycznych kwot, po `goalId` jako tekst (tryb ręczny). */
  errors?: Record<string, string>;
  /** Odmowa zapisu z powodu reguły (już rozliczony, brak kursu, niedostępny). */
  formError?: string;
  saveFailed?: boolean;
};

export const SETTLE_MESSAGES = {
  alreadySettled: "Ten miesiąc jest już rozliczony.",
  notAvailable: "Rozliczenie będzie dostępne od ostatniego dnia miesiąca.",
  notFound: "Tego miesiąca już nie ma.",
  noRate: "Ustaw kurs euro w Ustawieniach, żeby rozliczyć cel w euro.",
  invalid: "Popraw faktyczne kwoty i spróbuj ponownie.",
} as const;
