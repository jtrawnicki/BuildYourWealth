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
        placeholder="np. 8 500,00"
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
  placeholder,
  value,
  error,
  inputMode,
}: {
  id: string;
  name: string;
  label: string;
  placeholder?: string;
  value: string;
  error?: string;
  inputMode?: "decimal";
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        inputMode={inputMode}
        placeholder={placeholder}
        autoComplete="off"
        // Po akcji React czyści formularz do `defaultValue` ze stanu,
        // więc wpisana wartość zostaje w polu.
        defaultValue={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
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
