import type { IncomeFormState } from "./state";
import styles from "./page.module.css";

/** Pola pozycji przychodu (nazwa, kwota netto w PLN) wspólne dla dodawania i edycji. */
export function IncomeFields({
  prefix,
  state,
}: {
  prefix: string;
  state: IncomeFormState;
}) {
  const { values, errors } = state;
  return (
    <div className={styles.fields}>
      <Field
        id={`${prefix}-name`}
        name="name"
        label="Nazwa"
        value={values.name}
        error={errors?.name}
      />
      <Field
        id={`${prefix}-amount`}
        name="amount"
        label="Kwota netto (PLN)"
        hint="np. 8 500,00"
        value={values.amount}
        error={errors?.amount}
        inputMode="decimal"
      />
    </div>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  value,
  error,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  inputMode?: "decimal";
}) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      <input
        id={id}
        name={name}
        inputMode={inputMode}
        autoComplete="off"
        // Po akcji React czyści formularz do `defaultValue` ze stanu,
        // więc wpisana wartość zostaje w polu.
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={styles.input}
      />
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
