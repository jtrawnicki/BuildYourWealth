import { Suspense } from "react";
import Link from "next/link";
import { DemoBanner } from "@/ui/DemoBanner";
import { MainNav } from "@/ui/MainNav";
import { ThemeToggle } from "@/ui/ThemeToggle";
import styles from "./layout.module.css";

// Powłoka aplikacji (styl „Portfel"): boczny pasek z ikonami i nazwami zakładek,
// obok płótno z treścią wyśrodkowaną w dostępnej szerokości. Na telefonie pasek
// staje się dolną belką (reguły w `layout.module.css` i `MainNav.module.css`).
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            B
          </span>
          BuildYourWealth
        </Link>
        <MainNav />
        <div className={styles.railFoot}>
          <ThemeToggle />
        </div>
      </aside>
      <div className={styles.content}>
        <Suspense fallback={null}>
          <DemoBanner />
        </Suspense>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
