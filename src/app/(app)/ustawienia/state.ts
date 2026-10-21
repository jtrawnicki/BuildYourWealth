// Stan formularza kursu współdzielony przez akcję i komponent kliencki.
// `input` wraca do pola, więc po błędzie wpisana wartość zostaje (SPEC 7).
export type EurRateState = {
  input: string;
  fieldError?: string;
  saveFailed?: boolean;
  saved?: boolean;
};
