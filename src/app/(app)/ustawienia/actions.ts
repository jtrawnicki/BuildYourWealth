"use server";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { setFallbackEurRate } from "@/db/settings";
import { parseEurRate } from "@/domain/input";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import { field } from "@/app/form-data";
import type { EurRateState } from "./state";

export async function saveFallbackEurRate(
  _prev: EurRateState,
  formData: FormData,
): Promise<EurRateState> {
  const user = await requireUser();
  const input = field(formData, "fallbackEurRate");
  const rate = parseEurRate(input);
  if (!rate.ok) {
    return { input, fieldError: rate.error };
  }
  try {
    await setFallbackEurRate(getDb(), user.id, rate.value);
  } catch (error) {
    // Błąd zapisu lub budzącej się bazy (SPEC 7): wartość zostaje w polu.
    console.error(SAVE_ERROR_MESSAGE, error);
    return { input, saveFailed: true };
  }
  return { input, saved: true };
}
