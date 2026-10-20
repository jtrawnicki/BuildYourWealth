import { logout } from "@/auth/actions";
import { requireUser } from "@/auth/guard";
import styles from "./page.module.css";

// Zawartość zależy od sesji (guard czyta ciasteczko), więc strona jest
// dynamiczna i streamuje się za granicą `loading.tsx` (Cache Components).
// Docelowy ekran „Ten miesiąc” powstaje w T11; tu jest tymczasowy widok
// potwierdzający logowanie i dający punkt wyjścia do wylogowania.
export default async function Home() {
  const user = await requireUser();

  return (
    <section className={styles.home}>
      <h1>Ten miesiąc</h1>
      <p className={styles.account}>Zalogowano jako {user.email}</p>
      <form action={logout}>
        <button type="submit" className={styles.logout}>
          Wyloguj się
        </button>
      </form>
    </section>
  );
}
