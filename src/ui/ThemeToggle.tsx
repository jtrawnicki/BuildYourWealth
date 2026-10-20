"use client";

import { useLayoutEffect } from "react";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  applyTheme,
  themeFromCookies,
  type Theme,
} from "./theme";
import styles from "./ThemeToggle.module.css";

function visibleTheme(): Theme {
  const shown = document.documentElement.dataset.theme;
  if (shown === "light" || shown === "dark") return shown;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  // W trybie deweloperskim Strict Mode czyści atrybuty <html> ustawione przez
  // THEME_SCRIPT; w produkcji to nic nie zmienia.
  useLayoutEffect(() => applyTheme(themeFromCookies(document.cookie)), []);

  function toggle() {
    const next: Theme = visibleTheme() === "dark" ? "light" : "dark";
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
    applyTheme(next);
  }

  // Etykieta zależy od widocznego motywu, który przy motywie systemowym zna
  // tylko przeglądarka, więc wybiera ją CSS (ukryty wariant nie jest czytany).
  return (
    <button type="button" onClick={toggle} className={styles.toggle}>
      <span className={`visually-hidden ${styles.whenLight}`}>
        Włącz motyw ciemny
      </span>
      <span className={`visually-hidden ${styles.whenDark}`}>
        Włącz motyw jasny
      </span>
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}
