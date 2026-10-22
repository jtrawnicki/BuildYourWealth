// Stan formularzy przychodu współdzielony przez akcje i komponenty klienckie
// ekranu „Ten miesiąc". `values` wraca do pól, więc po błędzie wpisane dane
// zostają (SPEC 7).

export type IncomeFormValues = { name: string; amount: string };

export type IncomeFormState = {
  values: IncomeFormValues;
  errors?: { name?: string; amount?: string };
  /** Odmowa z powodu reguły SPEC 5.4 (miesiąca nie wolno utworzyć, rozliczony). */
  formError?: string;
  saveFailed?: boolean;
  saved?: boolean;
};

export type DeleteIncomeState = { formError?: string; saveFailed?: boolean };

export const EMPTY_INCOME: IncomeFormValues = { name: "", amount: "" };

export const INCOME_MESSAGES = {
  cannotCreate: "Tego miesiąca nie można już utworzyć.",
  settled: "Ten miesiąc jest już rozliczony.",
  notFound: "Tej pozycji przychodu już nie ma.",
} as const;
