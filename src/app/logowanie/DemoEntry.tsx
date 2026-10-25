"use client";

import { useActionState } from "react";
import { enterDemo } from "./actions";
import type { DemoEntryState } from "./state";
import styles from "./LoginForm.module.css";

const INITIAL: DemoEntryState = {};

/** Przycisk wejścia do wersji demo z komunikatem przekroczonego limitu (SPEC 5.8). */
export function DemoEntry() {
  const [state, formAction, pending] = useActionState(enterDemo, INITIAL);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Przygotowuję demo…" : "Wypróbuj wersję demo"}
      </button>
    </form>
  );
}
