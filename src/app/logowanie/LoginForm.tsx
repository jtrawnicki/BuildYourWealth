"use client";

import { useActionState } from "react";
import { login } from "./actions";
import type { LoginState } from "./state";
import styles from "./LoginForm.module.css";

const INITIAL: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, INITIAL);

  return (
    <form action={formAction} className={styles.form} noValidate>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <label className={styles.field}>
        <span>E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label className={styles.field}>
        <span>Hasło</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? "Logowanie…" : "Zaloguj się"}
      </button>
    </form>
  );
}
