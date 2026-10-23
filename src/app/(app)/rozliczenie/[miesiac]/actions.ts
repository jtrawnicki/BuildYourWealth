"use server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import {
  settleMonth,
  type ActualAmount,
  type SettleInput,
} from "@/db/settlement";
import { now } from "@/domain/clock";
import { parseActualAmount } from "@/domain/input";
import { canSettleMonth } from "@/domain/time";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { field } from "@/app/form-data";
import { SETTLE_MESSAGES, type SettleState } from "./state";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type ActualDraft = { goalId: number; amount: string };

/** Parsuje ładunek faktycznych kwot (tryb ręczny): `[{goalId, amount}]`. */
function parseActuals(raw: string): ActualDraft[] | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value)) return null;
  const drafts: ActualDraft[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const draft = item as Record<string, unknown>;
    if (
      typeof draft.goalId !== "number" ||
      !Number.isSafeInteger(draft.goalId) ||
      draft.goalId <= 0 ||
      typeof draft.amount !== "string"
    ) {
      return null;
    }
    drafts.push({ goalId: draft.goalId, amount: draft.amount });
  }
  return drafts;
}

export async function settleAction(
  _prev: SettleState,
  formData: FormData,
): Promise<SettleState> {
  const user = await requireUser();
  const month = field(formData, "month");
  if (!MONTH_PATTERN.test(month))
    return { formError: SETTLE_MESSAGES.notFound };
  // Dostępność od ostatniego dnia miesiąca (SPEC 5.5); broni akcji także wtedy,
  // gdy ekran był otwarty wcześniej.
  if (!canSettleMonth(month, now())) {
    return { formError: SETTLE_MESSAGES.notAvailable };
  }

  const mode = field(formData, "mode");
  let input: SettleInput;
  if (mode === "manual") {
    const drafts = parseActuals(field(formData, "actuals"));
    if (!drafts) return { formError: SETTLE_MESSAGES.invalid };
    const errors: Record<string, string> = {};
    const actuals: ActualAmount[] = [];
    for (const draft of drafts) {
      const parsed = parseActualAmount(draft.amount);
      if (!parsed.ok) {
        errors[String(draft.goalId)] = parsed.error;
        continue;
      }
      actuals.push({ goalId: draft.goalId, amount: parsed.value });
    }
    if (Object.keys(errors).length > 0) return { errors };
    input = { mode: "manual", actuals };
  } else if (mode === "plan") {
    input = { mode: "plan" };
  } else {
    return { formError: SETTLE_MESSAGES.invalid };
  }

  let result;
  try {
    result = await settleMonth(getDb(), user.id, month, input);
  } catch (error) {
    // Błąd zapisu lub budzącej się bazy (SPEC 7).
    console.error(SAVE_ERROR_MESSAGE, error);
    return { saveFailed: true };
  }

  // Po rozliczeniu wracamy na „Ten miesiąc", gdzie miesiąc jest już rozliczony.
  if (result.status === "ok") redirect("/");

  switch (result.status) {
    case "already-settled":
      refresh();
      return { formError: SETTLE_MESSAGES.alreadySettled };
    case "no-rate":
      refresh();
      return { formError: SETTLE_MESSAGES.noRate };
    case "not-found":
      refresh();
      return { formError: SETTLE_MESSAGES.notFound };
    case "invalid":
      return { formError: SETTLE_MESSAGES.invalid };
  }
}
