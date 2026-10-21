"use client";

import { useSyncExternalStore } from "react";
import {
  saveTheme,
  subscribeTheme,
  themeFromCookies,
  type Theme,
} from "@/ui/theme";
import styles from "./page.module.css";

export type ThemeChoice = Theme | "system";

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: "light", label: "Jasny" },
  { value: "dark", label: "Ciemny" },
  { value: "system", label: "Systemowy" },
];

const currentChoice = (): ThemeChoice =>
  themeFromCookies(document.cookie) ?? "system";

/**
 * Wybór motywu (SPEC 5.7). Stan bierze z ciasteczka, więc zgadza się
 * z przyciskiem w nagłówku; `initial` to wartość odczytana przez serwer.
 */
export function ThemePicker({ initial }: { initial: ThemeChoice }) {
  const choice = useSyncExternalStore(
    subscribeTheme,
    currentChoice,
    () => initial,
  );

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.label}>Motyw</legend>
      <div className={styles.segmented}>
        {OPTIONS.map(({ value, label }) => (
          <label key={value} className={styles.option}>
            <input
              type="radio"
              name="theme"
              value={value}
              checked={choice === value}
              onChange={() => saveTheme(value === "system" ? undefined : value)}
              className="visually-hidden"
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
