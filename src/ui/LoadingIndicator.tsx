import styles from "./LoadingIndicator.module.css";

export function LoadingIndicator() {
  return (
    <div role="status" className={styles.wrap}>
      <span aria-hidden="true" className={styles.spinner} />
      <span className="visually-hidden">Ładowanie…</span>
    </div>
  );
}
