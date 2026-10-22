"use client";

import { useActionState } from "react";
import { SaveError } from "@/ui/SaveError";
import { addIncomeAction } from "./actions";
import { IncomeFields } from "./IncomeFields";
import { EMPTY_INCOME, type IncomeFormState } from "./state";
import styles from "./page.module.css";

/** Formularz dodania przychodu do miesiąca `month` (tworzy go, jeśli nie istnieje). */
export function AddIncomeForm({ month }: { month: string }) {
  const [state, formAction, pending] = useActionState(addIncomeAction, {
    values: EMPTY_INCOME,
  } satisfies IncomeFormState);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.saveFailed && <SaveError />}
      {state.formError && (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      )}
      <input type="hidden" name="month" value={month} />
      <IncomeFields prefix={`add-${month}`} state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Zapisywanie…" : "Dodaj przychód"}
        </button>
      </div>
      <p role="status" className={styles.saved}>
        {state.saved && !pending ? "Dodano przychód." : ""}
      </p>
    </form>
  );
}
