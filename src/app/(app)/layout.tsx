import { Suspense } from "react";
import { AppHeader } from "@/ui/AppHeader";
import { DemoBanner } from "@/ui/DemoBanner";
import styles from "./layout.module.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <DemoBanner />
      </Suspense>
      <AppHeader />
      <main className={styles.main}>{children}</main>
    </>
  );
}
