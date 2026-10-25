import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { isDemo } from "@/demo/mode";
import { DemoEntry } from "./DemoEntry";
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
        <Suspense>
          <Entry />
        </Suspense>
      </section>
    </main>
  );
}

// Tryb czytamy przy żądaniu, nie przy buildzie: ten sam build działa jako
// wersja prywatna i demo (STACK 5, STACK 7).
async function Entry() {
  await connection();
  if (isDemo()) {
    return (
      <>
        <p className={styles.lead}>
          Miesięczny plan podziału przychodów na oszczędności i inwestycje.
        </p>
        <p className={styles.lead}>
          Wypróbuj wersję demo — dostaniesz własną piaskownicę z przykładowymi
          danymi. Znika po 24 godzinach i widzisz ją tylko Ty.
        </p>
        <DemoEntry />
      </>
    );
  }
  return (
    <>
      <p className={styles.lead}>Zaloguj się, aby zobaczyć swój plan.</p>
      <LoginForm />
    </>
  );
}
