"use server";
import { refresh } from "next/cache";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import {
  archiveSource,
  createSource,
  updateSource,
  type SourceInput,
} from "@/db/sources";
import { parseAmount, parseName } from "@/domain/input";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import {
  EMPTY_SOURCE,
  SOURCE_MESSAGES,
  type ArchiveState,
  type SourceFormState,
  type SourceFormValues,
} from "./state";

const KINDS = ["savings", "investments"] as const;
const CURRENCIES = ["PLN", "EUR"] as const;

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "");

function readValues(formData: FormData): SourceFormValues {
  return {
    name: field(formData, "name"),
    kind: field(formData, "kind"),
    currency: field(formData, "currency"),
    value: field(formData, "value"),
    note: field(formData, "note"),
  };
}

function readId(formData: FormData): number | null {
  const id = Number(field(formData, "id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const includes = <T extends string>(list: readonly T[], value: string) =>
  (list as readonly string[]).includes(value) ? (value as T) : null;

/** Waliduje pola funkcjami z `domain` (SPEC 7.1). */
function parseSource(
  values: SourceFormValues,
): { ok: true; input: SourceInput } | { ok: false; state: SourceFormState } {
  const name = parseName(values.name);
  const value = parseAmount(values.value);
  const kind = includes(KINDS, values.kind);
  const currency = includes(CURRENCIES, values.currency);
  if (!name.ok || !value.ok || !kind || !currency) {
    return {
      ok: false,
      state: {
        values,
        errors: {
          name: name.ok ? undefined : name.error,
          value: value.ok ? undefined : value.error,
          kind: kind && currency ? undefined : SOURCE_MESSAGES.kind,
        },
      },
    };
  }
  const note = values.note.trim();
  return {
    ok: true,
    input: {
      name: name.value,
      kind,
      currency,
      value: value.value,
      note: note === "" ? null : note,
    },
  };
}

export async function addSource(
  _prev: SourceFormState,
  formData: FormData,
): Promise<SourceFormState> {
  const user = await requireUser();
  const values = readValues(formData);
  const parsed = parseSource(values);
  if (!parsed.ok) return parsed.state;
  try {
    await createSource(getDb(), user.id, parsed.input);
  } catch (error) {
    // Błąd zapisu lub budzącej się bazy (SPEC 7): dane zostają w formularzu.
    console.error(SAVE_ERROR_MESSAGE, error);
    return { values, saveFailed: true };
  }
  refresh();
  return { values: EMPTY_SOURCE, saved: true };
}

export async function editSource(
  _prev: SourceFormState,
  formData: FormData,
): Promise<SourceFormState> {
  const user = await requireUser();
  const values = readValues(formData);
  const id = readId(formData);
  if (id === null) return { values, formError: SOURCE_MESSAGES.notFound };
  const parsed = parseSource(values);
  if (!parsed.ok) return parsed.state;
  let result;
  try {
    result = await updateSource(getDb(), user.id, id, parsed.input);
  } catch (error) {
    console.error(SAVE_ERROR_MESSAGE, error);
    return { values, saveFailed: true };
  }
  if (result === "kind-locked") {
    return { values, formError: SOURCE_MESSAGES.kindLocked };
  }
  refresh();
  if (result === "not-found") {
    return { values, formError: SOURCE_MESSAGES.notFound };
  }
  return { values, saved: true };
}

export async function archiveSourceAction(
  _prev: ArchiveState,
  formData: FormData,
): Promise<ArchiveState> {
  const user = await requireUser();
  const id = readId(formData);
  if (id === null) return { formError: SOURCE_MESSAGES.notFound };
  let result;
  try {
    result = await archiveSource(getDb(), user.id, id);
  } catch (error) {
    console.error(SAVE_ERROR_MESSAGE, error);
    return { saveFailed: true };
  }
  switch (result) {
    case "has-value":
      return { formError: SOURCE_MESSAGES.hasValue };
    case "in-use":
      return { formError: SOURCE_MESSAGES.inUse };
    case "not-found":
      refresh();
      return { formError: SOURCE_MESSAGES.notFound };
    case "ok":
      refresh();
      return {};
  }
}
