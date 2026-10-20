import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Logowanie — BuildYourWealth",
};

export default function LoginPage() {
  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.logo}>
          Build<span className={styles.accent}>Your</span>Wealth
        </h1>
        <p className={styles.lead}>Zaloguj się, aby zobaczyć swój plan.</p>
        <LoginForm />
      </section>
    </main>
  );
}
