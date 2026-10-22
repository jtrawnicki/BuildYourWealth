// Odczyt pól z `FormData` w Server Actions: brakujące pole to pusty string,
// a `id` to dodatnia liczba całkowita albo `null`.

export function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

export function readId(formData: FormData): number | null {
  const id = Number(field(formData, "id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
