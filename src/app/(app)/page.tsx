import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getMonth, type MonthData } from "@/db/months";
import { now } from "@/domain/clock";
import { formatMoney } from "@/domain/format";
import { formatMonthTitle, monthGenitive } from "@/domain/month-name";
import { currentMonth, previousMonth } from "@/domain/time";
import { AddIncomeForm } from "./AddIncomeForm";
import { IncomeItem, type IncomeView } from "./IncomeItem";
import styles from "./page.module.css";

// Zawartość zależy od sesji (guard czyta ciasteczko), więc strona jest
// dynamiczna i streamuje się za granicą `loading.tsx` (Cache Components).
// T10 obsługuje przychody i tworzenie miesięcy; pełny ekran „Ten miesiąc"
// z planem przelewów (makieta B1) powstaje w T11.
export default async function Home() {
  const user = await requireUser();
  const db = getDb();
  const current = currentMonth(now());
  const previous = previousMonth(current);
  const [currentData, previousData] = await Promise.all([
    getMonth(db, user.id, current),
    getMonth(db, user.id, previous),
  ]);

  return (
    <>
      <h1 className={styles.title}>Ten miesiąc</h1>
      <CurrentMonth month={current} data={currentData} />
      {previousData === null && <PreviousMonth month={previous} />}
    </>
  );
}

function toView(income: MonthData["incomes"][number]): IncomeView {
  return {
    id: income.id,
    name: income.name,
    amountText: formatMoney(income.amount, "PLN"),
    form: {
      name: income.name,
      amount: formatAmountField(income.amount),
    },
  };
}

// Kwota do pola edycji bez symbolu waluty: `850000` → `8 500,00`.
function formatAmountField(amount: number): string {
  return formatMoney(amount, "PLN").replace(/\s*zł$/u, "");
}

function CurrentMonth({
  month,
  data,
}: {
  month: string;
  data: MonthData | null;
}) {
  const title = formatMonthTitle(month);

  if (data === null) {
    return (
      <section className={styles.card} aria-labelledby="biezacy">
        <h2 id="biezacy" className={styles.cardTitle}>
          {title}
        </h2>
        <p className={styles.empty}>Wpisz przychód z {monthGenitive(month)}.</p>
        <AddIncomeForm month={month} />
      </section>
    );
  }

  const total = data.incomes.reduce((sum, income) => sum + income.amount, 0);

  return (
    <section className={styles.card} aria-labelledby="biezacy">
      <div className={styles.cardHead}>
        <h2 id="biezacy" className={styles.cardTitle}>
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
            income={toView(income)}
            readOnly={data.settled}
          />
        ))}
      </ul>
      {!data.settled && <AddIncomeForm month={month} />}
    </section>
  );
}

function PreviousMonth({ month }: { month: string }) {
  return (
    <section className={styles.card} aria-labelledby="poprzedni">
      <h2 id="poprzedni" className={styles.cardTitle}>
        Poprzedni miesiąc
      </h2>
      <p className={styles.empty}>
        Nie masz jeszcze przychodu za {formatMonthTitle(month)}. Możesz go dodać
        i rozliczyć później.
      </p>
      <AddIncomeForm month={month} />
    </section>
  );
}
