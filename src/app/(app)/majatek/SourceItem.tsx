"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { SaveError } from "@/ui/SaveError";
import { archiveSourceAction, editSource } from "./actions";
import { SourceFields } from "./SourceFields";
import type { ArchiveState, SourceFormState, SourceFormValues } from "./state";
import styles from "./page.module.css";

export type SourceView = {
  id: number;
  name: string;
  note: string | null;
  currency: "PLN" | "EUR";
  /** Wartość w walucie źródła, np. `1 000,00 €`. */
  valueText: string;
  /** Dla EUR wartość w PLN albo `null`, gdy brak kursu. */
  plnText: string | null;
  kindLocked: boolean;
  /** Wartości startowe formularza edycji. */
  form: SourceFormValues;
};

function EditForm({
  source,
  onDone,
}: {
  source: SourceView;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    async (prev: SourceFormState, formData: FormData) => {
      const next = await editSource(prev, formData);
      if (next.saved) onDone();
      return next;
    },
    { values: source.form } satisfies SourceFormState,
  );

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.saveFailed && <SaveError />}
      {state.formError && (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      )}
      <input type="hidden" name="id" value={source.id} />
      <SourceFields
        prefix={`source-${source.id}`}
        state={state}
        kindLocked={source.kindLocked}
      />
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

function ArchiveForm({
  source,
  onCancel,
}: {
  source: SourceView;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    archiveSourceAction,
    {} satisfies ArchiveState,
  );

  return (
    <form action={formAction} className={styles.confirm}>
      {state.saveFailed && <SaveError />}
      {state.formError ? (
        <p role="alert" className={styles.formError}>
          {state.formError}
        </p>
      ) : (
        <p className={styles.confirmText}>
          Zarchiwizować „{source.name}”? Źródło zniknie z listy i z sum majątku.
        </p>
      )}
      <input type="hidden" name="id" value={source.id} />
      <div className={styles.buttons}>
        {!state.formError && (
          <button type="submit" className={styles.danger} disabled={pending}>
            {pending ? "Archiwizowanie…" : "Tak, zarchiwizuj"}
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {state.formError ? "Zamknij" : "Anuluj"}
        </button>
      </div>
    </form>
  );
}

export function SourceItem({ source }: { source: SourceView }) {
  const [mode, setMode] = useState<"view" | "edit" | "archive">("view");
  const close = () => setMode("view");

  return (
    <li className={styles.item} aria-label={source.name}>
      <div className={styles.itemRow}>
        <div className={styles.itemText}>
          <span className={styles.itemName}>{source.name}</span>
          {source.note && (
            <span className={styles.itemNote}>{source.note}</span>
          )}
        </div>
        <div className={styles.itemValue}>
          <span className={styles.amount}>{source.valueText}</span>
          {source.currency === "EUR" &&
            (source.plnText ? (
              <span className={styles.itemNote}>≈ {source.plnText}</span>
            ) : (
              <Link href="/ustawienia" className={styles.rateLink}>
                Ustaw kurs EUR
              </Link>
            ))}
        </div>
      </div>
      {mode === "view" && (
        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setMode("edit")}
            aria-label={`Edytuj ${source.name}`}
          >
            Edytuj
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => setMode("archive")}
            aria-label={`Zarchiwizuj ${source.name}`}
          >
            Zarchiwizuj
          </button>
        </div>
      )}
      {mode === "edit" && <EditForm source={source} onDone={close} />}
      {mode === "archive" && <ArchiveForm source={source} onCancel={close} />}
    </li>
  );
}
