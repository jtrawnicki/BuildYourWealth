import { MainNav } from "./MainNav";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./AppHeader.module.css";

export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          Build<span className={styles.logoAccent}>Your</span>Wealth
        </div>
        <MainNav className={styles.nav} />
        <ThemeToggle />
      </div>
    </header>
  );
}
