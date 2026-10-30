import type { SourceFormState } from "./state";
import styles from "./page.module.css";

const KIND_OPTIONS = [
  { value: "savings", label: "Oszczędność" },
  { value: "investments", label: "Inwestycja" },
];
const CURRENCY_OPTIONS = [
  { value: "PLN", label: "PLN" },
  { value: "EUR", label: "EUR" },
];

export const KIND_LABEL: Record<string, string> = {
  savings: "Oszczędność",
  investments: "Inwestycja",
};

function Choice({
  legend,
  name,
  options,
  value,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
}) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={value === option.value}
              className="visually-hidden"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TextField({
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

/**
 * Pola źródła wspólne dla dodawania i edycji. Gdy `kindLocked`, typ i waluta
 * są tylko do odczytu (SPEC 5.2); serwer i tak sprawdza tę regułę.
 */
export function SourceFields({
  prefix,
  state,
  kindLocked = false,
}: {
  prefix: string;
  state: SourceFormState;
  kindLocked?: boolean;
}) {
  const { values, errors } = state;
  return (
    <>
      <TextField
        id={`${prefix}-name`}
        name="name"
        label="Nazwa"
        value={values.name}
        error={errors?.name}
      />
      {kindLocked ? (
        <div className={styles.field}>
          <span className={styles.label}>Typ i waluta</span>
          <span>
            {KIND_LABEL[values.kind]} · {values.currency}
          </span>
          <span className={styles.hint}>
            Nie można ich zmienić, bo źródło jest połączone z celem albo ma
            rozliczone wpłaty.
          </span>
          <input type="hidden" name="kind" value={values.kind} />
          <input type="hidden" name="currency" value={values.currency} />
        </div>
      ) : (
        <div className={styles.choices}>
          <Choice
            legend="Typ"
            name="kind"
            options={KIND_OPTIONS}
            value={values.kind}
          />
          <Choice
            legend="Waluta"
            name="currency"
            options={CURRENCY_OPTIONS}
            value={values.currency}
          />
          {errors?.kind && <p className={styles.fieldError}>{errors.kind}</p>}
        </div>
      )}
      <TextField
        id={`${prefix}-value`}
        name="value"
        label="Bieżąca wartość"
        hint="W walucie źródła, np. 1 234,56"
        value={values.value}
        error={errors?.value}
        inputMode="decimal"
      />
      <TextField
        id={`${prefix}-note`}
        name="note"
        label="Notatka lub instytucja (opcjonalnie)"
        value={values.note}
      />
      <div className={styles.field}>
        <label className={styles.check}>
          <input
            type="checkbox"
            name="excluded"
            defaultChecked={values.excluded !== ""}
            aria-describedby={`${prefix}-excluded-hint`}
          />
          Nie wliczaj do majątku
        </label>
        <span id={`${prefix}-excluded-hint`} className={styles.hint}>
          Np. nadpłata kredytu: odkładasz na nią, ale nie jest Twoim majątkiem.
          Źródło zostaje na liście i w celach, ale nie wchodzi do sum ani do
          wykresu.
        </span>
      </div>
    </>
  );
}
