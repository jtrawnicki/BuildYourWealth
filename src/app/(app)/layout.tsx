import { AppHeader } from "@/ui/AppHeader";
import styles from "./layout.module.css";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppHeader />
      <main className={styles.main}>{children}</main>
    </>
  );
}
