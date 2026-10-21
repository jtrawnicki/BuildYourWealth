"use client";

import { useActionState } from "react";
import { SaveError } from "@/ui/SaveError";
import { addSource } from "./actions";
import { SourceFields } from "./SourceFields";
import { EMPTY_SOURCE, type SourceFormState } from "./state";
import styles from "./page.module.css";

export function AddSourceForm() {
  const [state, formAction, pending] = useActionState(addSource, {
    values: EMPTY_SOURCE,
  } satisfies SourceFormState);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.saveFailed && <SaveError />}
      <SourceFields prefix="add" state={state} />
      <div className={styles.buttons}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Zapisywanie…" : "Dodaj źródło"}
        </button>
      </div>
      <p role="status" className={styles.saved}>
        {state.saved && !pending ? "Dodano źródło." : ""}
      </p>
    </form>
  );
}
