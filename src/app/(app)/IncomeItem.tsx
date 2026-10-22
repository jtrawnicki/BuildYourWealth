"use client";

import { useActionState, useState } from "react";
import { SaveError } from "@/ui/SaveError";
import { deleteIncomeAction, editIncomeAction } from "./actions";
import { IncomeFields } from "./IncomeFields";
import type {
  DeleteIncomeState,
  IncomeFormState,
  IncomeFormValues,
} from "./state";
import styles from "./page.module.css";

export type IncomeView = {
  id: number;
  name: string;
  /** Kwota w PLN, np. `8 500,00 zł`. */
  amountText: string;
  /** Wartości startowe formularza edycji. */
  form: IncomeFormValues;
};

function EditForm({
  income,
  onDone,
}: {
  income: IncomeView;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: IncomeFormState, formData: FormData) => {
      const next = await editIncomeAction(prev, formData);
      if (next.saved) onDone();
      return next;
    },
    { values: income.form } satisfies IncomeFormState,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.saveFailed && <SaveError />}
      {state.formError && (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      )}
      <input type="hidden" name="id" value={income.id} />
      <IncomeFields prefix={`income-${income.id}`} state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Zapisywanie…" : "Zapisz zmiany"}
        </button>
        <button type="button" className={styles.secondary} onClick={onDone}>
          Anuluj
        </button>
      </div>
    </form>
  );
}

function DeleteForm({
  income,
  onCancel,
}: {
  income: IncomeView;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    deleteIncomeAction,
    {} satisfies DeleteIncomeState,
  );

  return (
    <form action={formAction} className={styles.confirm}>
      {state.saveFailed && <SaveError />}
      {state.formError ? (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      ) : (
        <p className={styles.confirmText}>Usunąć przychód „{income.name}”?</p>
      )}
      <input type="hidden" name="id" value={income.id} />
      <div className={styles.buttons}>
        {!state.formError && (
          <button type="submit" className={styles.danger} disabled={pending}>
            {pending ? "Usuwanie…" : "Tak, usuń"}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {state.formError ? "Zamknij" : "Anuluj"}
        </button>
      </div>
    </form>
  );
}

/** Pozycja przychodu z edycją i usuwaniem; `readOnly` dla rozliczonego miesiąca. */
export function IncomeItem({
  income,
  readOnly = false,
}: {
  income: IncomeView;
  readOnly?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const close = () => setMode("view");

  return (
    <li className={styles.item} aria-label={income.name}>
      <div className={styles.itemRow}>
        <span className={styles.itemName}>{income.name}</span>
        <span className={styles.amount}>{income.amountText}</span>
      </div>
      {!readOnly && mode === "view" && (
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setMode("edit")}
            aria-label={`Edytuj ${income.name}`}
          >
            Edytuj
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setMode("delete")}
            aria-label={`Usuń ${income.name}`}
          >
            Usuń
          </button>
        </div>
      )}
      {mode === "edit" && <EditForm income={income} onDone={close} />}
      {mode === "delete" && <DeleteForm income={income} onCancel={close} />}
    </li>
  );
}
