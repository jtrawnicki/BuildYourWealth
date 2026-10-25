// Stan formularza logowania współdzielony przez akcję i komponent kliencki.
export type LoginState = { error?: string };

// Stan wejścia do wersji demo (SPEC 5.8). Sukces przekierowuje, więc stan niesie
// tylko komunikat przekroczonego limitu albo błędu zapisu.
export type DemoEntryState = { error?: string };

export const DEMO_MESSAGES = {
  tooManyIp: "Za dużo wejść do wersji demo. Spróbuj ponownie za godzinę.",
  overloaded: "Wersja demo jest teraz przeciążona. Spróbuj ponownie później.",
} as const;
