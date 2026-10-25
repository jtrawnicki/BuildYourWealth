import { connection } from "next/server";
import { isDemo } from "@/demo/mode";
import styles from "./DemoBanner.module.css";

// Baner wersji demo na każdym ekranie piaskownicy (SPEC 5.8). Tryb czytamy przy
// żądaniu (`connection()`), nie przy buildzie: ten sam build działa jako wersja
// prywatna i demo (STACK 5), więc baner nie może być zapieczony w szkielecie.
// W trybie prywatnym komponent nic nie renderuje.
export async function DemoBanner() {
  await connection();
  if (!isDemo()) return null;
  return (
    <div role="status" className={styles.banner}>
      Wersja demonstracyjna. Dane są przykładowe, widzisz je tylko Ty i znikną
      po 24 godzinach.
    </div>
  );
}
