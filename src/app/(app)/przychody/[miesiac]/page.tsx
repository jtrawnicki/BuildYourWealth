import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getMonth } from "@/db/months";
import { formatMoney } from "@/domain/format";
import { formatMonthTitle } from "@/domain/month-name";
import { AddIncomeForm } from "../../AddIncomeForm";
import { toIncomeView } from "../../income-view";
import { IncomeItem } from "../../IncomeItem";
import styles from "./page.module.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Trasa dynamiczna (`[miesiac]`) wymaga sesji i danych z bazy; renderujemy ją
// w czasie żądania jak rozliczenie (Cache Components).
export const instant = false;

// Edycja przychodów wybranego miesiąca (SPEC 5.4). Wejście z Historii dla
// nierozliczonego miesiąca z przeszłości, który na stronie głównej się nie
// pokazuje. Rozliczony miesiąc jest tylko do odczytu. Akcje (`../../actions`)
// pilnują własności i blokady rozliczonego, więc tu tylko składamy widok.
export default async function EditIncomesPage({
  params,
}: PageProps<"/przychody/[miesiac]">) {
  const user = await requireUser();
  const { miesiac } = await params;
  if (!MONTH_PATTERN.test(miesiac)) notFound();

  const data = await getMonth(getDb(), user.id, miesiac);
  // Edytować można tylko istniejący miesiąc z przychodem (SPEC 5.4). Gdy zniknął
  // (usunięcie ostatniej pozycji kasuje miesiąc, P7), wracamy na Historię zamiast
  // pokazywać 404.
  if (data === null || data.incomes.length === 0) redirect("/historia");

  const title = formatMonthTitle(miesiac);
  const total = data.incomes.reduce((sum, income) => sum + income.amount, 0);

  return (
    <>
      <h1 className={styles.title}>Przychody · {title}</h1>

      <section className={styles.card} aria-labelledby="przychody">
        <div className={styles.cardHead}>
          <h2 id="przychody" className={styles.cardTitle}>
            {title}
          </h2>
          <p className={styles.total}>
            <span className={styles.totalLabel}>Przychód łącznie</span>
            <span className={styles.totalAmount}>
              {formatMoney(total, "PLN")}
            </span>
          </p>
        </div>

        {data.settled && (
          <p className={styles.note}>Miesiąc rozliczony — tylko do odczytu.</p>
        )}

        <ul className={styles.list}>
          {data.incomes.map((income) => (
            <IncomeItem
              key={income.id}
              income={toIncomeView(income)}
              readOnly={data.settled}
            />
          ))}
        </ul>

        {!data.settled && <AddIncomeForm month={miesiac} />}
      </section>

      <Link href="/historia" className={styles.backLink}>
        Wróć do Historii
      </Link>
    </>
  );
}
