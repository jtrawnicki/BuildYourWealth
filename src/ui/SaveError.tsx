import styles from "./SaveError.module.css";

export const SAVE_ERROR_MESSAGE = "Nie udało się zapisać. Spróbuj ponownie.";

/** Komunikat błędu zapisu; formularz pokazuje go, zachowując wpisane dane. */
export function SaveError() {
  return (
    <div role="alert" className={styles.error}>
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
        className={styles.icon}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h0" />
      </svg>
      <span>{SAVE_ERROR_MESSAGE}</span>
    </div>
  );
}
