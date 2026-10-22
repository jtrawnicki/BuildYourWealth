import Link from "next/link";
import styles from "./WealthBar.module.css";

// Ciemny pasek majątku ekranu „Ten miesiąc" (makieta B1, SPEC 5.4): suma
// majątku z liczbą źródeł i link do Majątku. Bez kursu przy źródle w EUR nie da
// się policzyć sumy, więc pasek prosi o kurs zamiast kwoty (SPEC 7).
export type WealthView =
  | { ok: true; countLabel: string; totalLabel: string }
  | { ok: false; countLabel: string };

export function WealthBar({ view }: { view: WealthView }) {
  return (
    <section className={styles.bar} aria-label="Majątek">
      <div className={styles.info}>
        <span className={styles.label}>
          Majątek łącznie ({view.countLabel})
        </span>
        {view.ok ? (
          <span className={styles.total}>{view.totalLabel}</span>
        ) : (
          <span className={styles.rate}>
            <Link href="/ustawienia" className={styles.rateLink}>
              Ustaw kurs EUR
            </Link>
            , aby zobaczyć sumę majątku.
          </span>
        )}
      </div>
      <Link href="/majatek" className={styles.link}>
        Zobacz majątek
      </Link>
    </section>
  );
}
