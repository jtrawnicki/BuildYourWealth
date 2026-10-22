import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getMonth, getMonthSnapshot, type MonthData } from "@/db/months";
import { getEurRate } from "@/db/settings";
import { listSources } from "@/db/sources";
import { now } from "@/domain/clock";
import {
  convertEurToPln,
  convertPlnToEur,
  netWorthPln,
} from "@/domain/currency";
import {
  formatMoney,
  formatPercent,
  formatProgress,
  formatSourceCount,
} from "@/domain/format";
import { formatMonthTitle, monthGenitive } from "@/domain/month-name";
import {
  computeMonthPlan,
  type Pool,
  type MonthPlan as MonthPlanResult,
} from "@/domain/plan";
import { isGoalReached } from "@/domain/progress";
import { currentMonth, previousMonth } from "@/domain/time";
import { AddIncomeForm } from "./AddIncomeForm";
import { IncomeItem, type IncomeView } from "./IncomeItem";
import {
  MonthPlan,
  type MonthPlanView,
  type PoolGroup,
  type TransferItem,
} from "./MonthPlan";
import { WealthBar, type WealthView } from "./WealthBar";
import styles from "./page.module.css";

// Zawartość zależy od sesji (guard czyta ciasteczko), więc strona jest
// dynamiczna i streamuje się za granicą `loading.tsx` (Cache Components).
// Ekran „Ten miesiąc" (makieta B1, SPEC 5.4, 8): przychody (T10), plan podziału
// z kartami przelewów i pasek majątku. Plan liczy się z migawki miesiąca
// (`month_goals`) przy każdym odczycie, nie jest zapisywany (STACK 3).
export default async function Home() {
  const user = await requireUser();
  const db = getDb();
  const current = currentMonth(now());
  const previous = previousMonth(current);
  const [currentData, previousData, sources, eurRate] = await Promise.all([
    getMonth(db, user.id, current),
    getMonth(db, user.id, previous),
    listSources(db, user.id),
    getEurRate(db, user.id),
  ]);

  const hasIncome = currentData !== null && currentData.incomes.length > 0;
  const planView = hasIncome
    ? await buildPlanView(db, currentData, eurRate)
    : null;

  const wealthView = buildWealthView(sources, eurRate);

  return (
    <>
      <h1 className={styles.title}>Ten miesiąc</h1>
      <CurrentMonth month={current} data={currentData} />
      {planView !== null && <MonthPlan view={planView} />}
      {previousData === null && <PreviousMonth month={previous} />}
      <WealthBar view={wealthView} />
    </>
  );
}

const POOL_TITLE: Record<Pool, string> = {
  savings: "Oszczędności",
  investments: "Inwestycje",
};

/** Składa widok planu z migawki miesiąca i obliczeń domeny (SPEC 5.4, 6). */
async function buildPlanView(
  db: ReturnType<typeof getDb>,
  data: MonthData,
  eurRate: number | null,
): Promise<MonthPlanView> {
  const snapshot = await getMonthSnapshot(db, data.id);
  const income = data.incomes.reduce((sum, item) => sum + item.amount, 0);
  const plan = computeMonthPlan({
    income,
    savingsPct: data.savingsPct,
    investmentsPct: data.investmentsPct,
    goals: snapshot.map((goal) => ({
      id: goal.goalId,
      pool: goal.pool,
      pct: goal.pct,
    })),
  });
  const amountByGoal = new Map(
    plan.goals.map((goal) => [goal.id, goal.amount]),
  );

  const groups: PoolGroup[] = [];
  for (const pool of ["savings", "investments"] as const) {
    const items = snapshot
      .filter((goal) => goal.pool === pool)
      .map((goal) =>
        buildItem(goal, amountByGoal.get(goal.goalId) ?? 0, data, eurRate),
      );
    if (items.length > 0) {
      groups.push({
        pool,
        title: POOL_TITLE[pool],
        totalLabel: formatMoney(plan.pools[pool], "PLN"),
        items,
      });
    }
  }

  return {
    settled: data.settled,
    setAsideLabel: formatMoney(income - plan.toSpend, "PLN"),
    toSpendLabel: formatMoney(plan.toSpend, "PLN"),
    segments: buildSegments(plan, income),
    legend: [
      {
        key: "savings",
        label: "Oszczędności",
        amountLabel: formatMoney(plan.pools.savings, "PLN"),
      },
      {
        key: "investments",
        label: "Inwestycje",
        amountLabel: formatMoney(plan.pools.investments, "PLN"),
      },
      {
        key: "spend",
        label: "Do wydania",
        amountLabel: formatMoney(plan.toSpend, "PLN"),
      },
    ],
    groups,
  };
}

/** Szerokości pasków w procentach przychodu; zerowe segmenty pomijamy. */
function buildSegments(plan: MonthPlanResult, income: number) {
  const parts: { key: "savings" | "investments" | "spend"; amount: number }[] =
    [
      { key: "savings", amount: plan.pools.savings },
      { key: "investments", amount: plan.pools.investments },
      { key: "spend", amount: plan.toSpend },
    ];
  return parts
    .filter((part) => part.amount > 0)
    .map((part) => {
      const widthPct = (part.amount * 100) / income;
      return {
        key: part.key,
        pctLabel: `${Math.round(widthPct)}%`,
        widthPct,
      };
    });
}

function buildItem(
  goal: Awaited<ReturnType<typeof getMonthSnapshot>>[number],
  amount: number,
  data: MonthData,
  eurRate: number | null,
): TransferItem {
  // `goal.progress` z bazy to kwota startowa + wpłaty z rozliczonych miesięcy
  // (reguła `goalProgress`, SPEC 6.6). Postęp pokazujemy tylko dla celu z kwotą
  // docelową; „osiągnięty" zastępuje liczby (SPEC 5.3, scen. 10).
  const target = goal.targetAmount;
  const progress: TransferItem["progress"] =
    target === null
      ? null
      : isGoalReached(goal.progress, target)
        ? { reached: true }
        : {
            reached: false,
            label: formatProgress(goal.progress, target, goal.currency),
            widthPct:
              target > 0 ? Math.min(100, (goal.progress * 100) / target) : 100,
          };

  return {
    goalId: goal.goalId,
    pool: goal.pool,
    name: goal.name,
    sourceName: goal.sourceName,
    pctLabel: formatPercent(goal.pct),
    amountLabel: formatMoney(amount, "PLN"),
    eur: buildEurLine(goal, amount, data.settled, eurRate),
    progress,
    actualLabel: data.settled
      ? buildActualLabel(goal, data.settledEurRate)
      : null,
  };
}

/** Druga linia kwoty celu EUR w otwartym miesiącu (SPEC 5.4). */
function buildEurLine(
  goal: { currency: "PLN" | "EUR" },
  amount: number,
  settled: boolean,
  eurRate: number | null,
): TransferItem["eur"] {
  if (goal.currency !== "EUR" || settled) return null;
  if (eurRate === null) return { kind: "rate" };
  return {
    kind: "amount",
    text: `≈ ${formatMoney(convertPlnToEur(amount, eurRate), "EUR")}`,
  };
}

/** Wykonanie celu w rozliczonym miesiącu; EUR po kursie z rozliczenia (SPEC 6.9). */
function buildActualLabel(
  goal: { currency: "PLN" | "EUR"; actualAmount: number | null },
  settledEurRate: number | null,
): string {
  const actual = goal.actualAmount ?? 0;
  if (goal.currency === "PLN") {
    return `wykonanie: ${formatMoney(actual, "PLN")}`;
  }
  const eur = formatMoney(actual, "EUR");
  if (settledEurRate === null) return `wykonanie: ${eur}`;
  const pln = formatMoney(convertEurToPln(actual, settledEurRate), "PLN");
  return `wykonanie: ${eur} (${pln})`;
}

function buildWealthView(
  sources: { currency: "PLN" | "EUR"; value: number }[],
  eurRate: number | null,
): WealthView {
  const countLabel = formatSourceCount(sources.length);
  const worth = netWorthPln(sources, eurRate);
  if (!worth.ok) return { ok: false, countLabel };
  return { ok: true, countLabel, totalLabel: formatMoney(worth.pln, "PLN") };
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
  const settled = data?.settled ?? false;
  const incomes = data?.incomes ?? [];
  const total = incomes.reduce((sum, income) => sum + income.amount, 0);

  // Formularz dodawania ma stałą pozycję i `key`, więc przejście pusty →
  // wypełniony nie odmontowuje go i zachowuje stan (potwierdzenie „Dodano").
  return (
    <section className={styles.card} aria-labelledby="biezacy">
      <div className={styles.cardHead}>
        <h2 id="biezacy" className={styles.cardTitle}>
          {title}
        </h2>
        {data !== null && (
          <p className={styles.total}>
            <span className={styles.totalLabel}>Przychód łącznie</span>
            <span className={styles.totalAmount}>
              {formatMoney(total, "PLN")}
            </span>
          </p>
        )}
      </div>
      {settled && (
        <p className={styles.note}>Miesiąc rozliczony — tylko do odczytu.</p>
      )}
      {data === null ? (
        <p className={styles.empty}>Wpisz przychód z {monthGenitive(month)}.</p>
      ) : (
        <ul className={styles.list}>
          {incomes.map((income) => (
            <IncomeItem
              key={income.id}
              income={toView(income)}
              readOnly={settled}
            />
          ))}
        </ul>
      )}
      {!settled && <AddIncomeForm key="add-income" month={month} />}
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
