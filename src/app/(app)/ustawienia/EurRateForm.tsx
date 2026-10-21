"use client";

import { useActionState } from "react";
import { SaveError } from "@/ui/SaveError";
import { saveEurRate } from "./actions";
import type { EurRateState } from "./state";
import styles from "./page.module.css";

export function EurRateForm({ initial }: { initial: string }) {
  const [state, formAction, pending] = useActionState(saveEurRate, {
    input: initial,
  } satisfies EurRateState);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.saveFailed && <SaveError />}
      <label className={styles.field}>
        <span className={styles.label}>Kurs EUR→PLN</span>
        <span className={styles.hint} id="eur-rate-hint">
          Ile złotych kosztuje 1 €, np. 4,2850
        </span>
        <span className={styles.row}>
          <input
            name="eurRate"
            inputMode="decimal"
            autoComplete="off"
            // Po akcji React czyści formularz do `defaultValue`, które
            // przychodzi ze stanu, więc wpisana wartość zostaje w polu.
            defaultValue={state.input}
            aria-invalid={state.fieldError ? true : undefined}
            aria-describedby={
              state.fieldError
                ? "eur-rate-hint eur-rate-error"
                : "eur-rate-hint"
            }
            className={styles.input}
          />
          <button type="submit" className={styles.submit} disabled={pending}>
            {pending ? "Zapisywanie…" : "Zapisz kurs"}
          </button>
        </span>
      </label>
      {state.fieldError && (
        <p id="eur-rate-error" className={styles.fieldError}>
          {state.fieldError}
        </p>
      )}
      <p role="status" className={styles.saved}>
        {state.saved && !pending ? "Zapisano kurs." : ""}
      </p>
    </form>
  );
}
