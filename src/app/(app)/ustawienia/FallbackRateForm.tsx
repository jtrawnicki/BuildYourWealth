"use client";

import { useActionState } from "react";
import { SaveError } from "@/ui/SaveError";
import { saveFallbackEurRate } from "./actions";
import type { EurRateState } from "./state";
import styles from "./page.module.css";

// Pole kursu zapasowego (SPEC 5.9): używany tylko, gdy aplikacja nie ma kursu
// z NBP. Bieżący kurs NBP pokazuje strona (serwer), to pole go nie dotyka.
export function FallbackRateForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState(saveFallbackEurRate, {
    input: initial,
  } satisfies EurRateState);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.saveFailed && <SaveError />}
      <div className={styles.field}>
        <label htmlFor="fallback-rate" className={styles.label}>
          Kurs zapasowy EUR→PLN
        </label>
        <span className={styles.hint} id="fallback-rate-hint">
          Używany, gdy nie uda się pobrać kursu z NBP, np. 4,3000
        </span>
        <div className={styles.row}>
          <input
            id="fallback-rate"
            name="fallbackEurRate"
            inputMode="decimal"
            autoComplete="off"
            // Po akcji React czyści formularz do `defaultValue`, które
            // przychodzi ze stanu, więc wpisana wartość zostaje w polu.
            defaultValue={state.input}
            aria-invalid={state.fieldError ? true : undefined}
            aria-describedby={
              state.fieldError
                ? "fallback-rate-hint fallback-rate-error"
                : "fallback-rate-hint"
            }
            className={styles.input}
          />
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? "Zapisywanie…" : "Zapisz kurs zapasowy"}
          </button>
        </div>
      </div>
      {state.fieldError && (
        <p id="fallback-rate-error" className={styles.fieldError}>
          {state.fieldError}
        </p>
      )}
      <p role="status" className={styles.saved}>
        {state.saved && !pending ? "Zapisano kurs zapasowy." : ""}
      </p>
    </form>
  );
}
