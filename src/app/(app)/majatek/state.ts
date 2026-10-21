// Stan formularzy źródła współdzielony przez akcje i komponenty klienckie.
// `values` wraca do pól, więc po błędzie wpisane dane zostają (SPEC 7).

export type SourceFormValues = {
  name: string;
  kind: string;
  currency: string;
  value: string;
  note: string;
};

export type SourceFormState = {
  values: SourceFormValues;
  errors?: { name?: string; value?: string; kind?: string };
  /** Odmowa zapisu z powodu reguły SPEC 5.2 albo nieaktualnego źródła. */
  formError?: string;
  saveFailed?: boolean;
  saved?: boolean;
};

export type ArchiveState = { formError?: string; saveFailed?: boolean };

export const EMPTY_SOURCE: SourceFormValues = {
  name: "",
  kind: "savings",
  currency: "PLN",
  value: "",
  note: "",
};

export const SOURCE_MESSAGES = {
  kind: "Wybierz typ i walutę źródła.",
  kindLocked:
    "Typu i waluty nie można zmienić, bo źródło jest połączone z celem albo ma rozliczone wpłaty.",
  hasValue:
    "Zarchiwizować można tylko źródło o wartości 0. Najpierw zmień wartość na 0,00.",
  inUse:
    "Tego źródła używa cel w planie podziału albo w nierozliczonym miesiącu.",
  notFound: "To źródło zostało już zarchiwizowane albo nie istnieje.",
} as const;
