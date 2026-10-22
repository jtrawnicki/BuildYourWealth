"use server";
import { refresh } from "next/cache";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import {
  addIncome,
  deleteIncome,
  updateIncome,
  type IncomeInput,
} from "@/db/months";
import { now } from "@/domain/clock";
import { parseIncomeAmount, parseName } from "@/domain/input";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import {
  EMPTY_INCOME,
  INCOME_MESSAGES,
  type DeleteIncomeState,
  type IncomeFormState,
  type IncomeFormValues,
} from "./state";

const field = (formData: FormData, name: string) =>
  String(formData.get(name) ?? "");

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function readValues(formData: FormData): IncomeFormValues {
  return { name: field(formData, "name"), amount: field(formData, "amount") };
}

function readId(formData: FormData): number | null {
  const id = Number(field(formData, "id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Waliduje nazwę i kwotę przychodu (SPEC 7.1). */
function parseIncome(
  values: IncomeFormValues,
): { ok: true; input: IncomeInput } | { ok: false; state: IncomeFormState } {
  const name = parseName(values.name);
  const amount = parseIncomeAmount(values.amount);
  if (!name.ok || !amount.ok) {
    return {
      ok: false,
      state: {
        values,
        errors: {
          name: name.ok ? undefined : name.error,
          amount: amount.ok ? undefined : amount.error,
        },
      },
    };
  }
  return { ok: true, input: { name: name.value, amount: amount.value } };
}

export async function addIncomeAction(
  _prev: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const user = await requireUser();
  const values = readValues(formData);
  const month = field(formData, "month");
  if (!MONTH_PATTERN.test(month)) {
    return { values, formError: INCOME_MESSAGES.cannotCreate };
  }
  const parsed = parseIncome(values);
  if (!parsed.ok) return parsed.state;
  let result;
  try {
    result = await addIncome(getDb(), user.id, month, parsed.input, now());
  } catch (error) {
    // Błąd zapisu lub budzącej się bazy (SPEC 7): dane zostają w formularzu.
    console.error(SAVE_ERROR_MESSAGE, error);
    return { values, saveFailed: true };
  }
  if (result.status === "cannot-create") {
    return { values, formError: INCOME_MESSAGES.cannotCreate };
  }
  if (result.status === "settled") {
    refresh();
    return { values, formError: INCOME_MESSAGES.settled };
  }
  refresh();
  return { values: EMPTY_INCOME, saved: true };
}

export async function editIncomeAction(
  _prev: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const user = await requireUser();
  const values = readValues(formData);
  const id = readId(formData);
  if (id === null) return { values, formError: INCOME_MESSAGES.notFound };
  const parsed = parseIncome(values);
  if (!parsed.ok) return parsed.state;
  let result;
  try {
    result = await updateIncome(getDb(), user.id, id, parsed.input);
  } catch (error) {
    console.error(SAVE_ERROR_MESSAGE, error);
    return { values, saveFailed: true };
  }
  if (result === "settled") {
    refresh();
    return { values, formError: INCOME_MESSAGES.settled };
  }
  if (result === "not-found") {
    refresh();
    return { values, formError: INCOME_MESSAGES.notFound };
  }
  refresh();
  return { values, saved: true };
}

export async function deleteIncomeAction(
  _prev: DeleteIncomeState,
  formData: FormData,
): Promise<DeleteIncomeState> {
  const user = await requireUser();
  const id = readId(formData);
  if (id === null) return { formError: INCOME_MESSAGES.notFound };
  let result;
  try {
    result = await deleteIncome(getDb(), user.id, id);
  } catch (error) {
    console.error(SAVE_ERROR_MESSAGE, error);
    return { saveFailed: true };
  }
  if (result.status === "settled") {
    refresh();
    return { formError: INCOME_MESSAGES.settled };
  }
  if (result.status === "not-found") {
    refresh();
    return { formError: INCOME_MESSAGES.notFound };
  }
  refresh();
  return {};
}
