import Link from "next/link";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import {
  getMonth,
  getMonthSnapshot,
  listOverdueMonths,
  type MonthData,
} from "@/db/months";
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
import { computeMonthPlan, type Pool } from "@/domain/plan";
import { isGoalReached } from "@/domain/progress";
import { canSettleMonth, currentMonth, previousMonth } from "@/domain/time";
import { AddIncomeForm } from "./AddIncomeForm";
import { toIncomeView } from "./income-view";
import { IncomeItem } from "./IncomeItem";
import {
  MonthPlan,
  type MonthPlanView,
  type PoolGroup,
  type Segment,
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
  const [currentData, previousData, overdue, sources, eurRate] =
    await Promise.all([
      getMonth(db, user.id, current),
      getMonth(db, user.id, previous),
      listOverdueMonths(db, user.id, current),
      listSources(db, user.id),
      getEurRate(db, user.id),
    ]);

  const hasIncome = currentData !== null && currentData.incomes.length > 0;
  const planView = hasIncome
    ? await buildPlanView(db, currentData, eurRate)
    : null;

  // Rozliczenie bieżącego miesiąca jest dostępne od jego ostatniego dnia
  // (SPEC 5.5). Zaległe miesiące z przeszłości mają osobne pigułki nad
  // nagłówkiem, od najstarszego (SPEC 5.5, scen. 7).
  const canSettle =
    hasIncome && !currentData.settled && canSettleMonth(current, now());

  const wealthView = buildWealthView(sources, eurRate);

  return (
    <>
      {overdue.length > 0 && <OverdueMonths months={overdue} />}
      <h1 className={styles.title}>Ten miesiąc</h1>
      <CurrentMonth
        month={current}
        data={currentData}
        settleHref={canSettle ? `/rozliczenie/${current}` : null}
      />
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

type SnapshotGoalRow = Awaited<ReturnType<typeof getMonthSnapshot>>[number];

/**
 * Składa widok ekranu „Ten miesiąc" z migawki miesiąca i obliczeń domeny.
 * Miesiąc otwarty pokazuje plan (SPEC 6.1–6.5); rozliczony — kwoty faktyczne
 * jako główne liczby (SPEC 5.4), a pule, „do wydania" i pasek liczy z wpłat
 * sprowadzonych do PLN kursem rozliczenia (SPEC 6.8). Gdy wpłaty w EUR nie mają
 * kursu rozliczenia (`summable` = false), zdanie z kwotami i pasek znikają.
 */
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
  const planByGoal = new Map(plan.goals.map((goal) => [goal.id, goal.amount]));

  // Każdą wpłatę faktyczną sprowadzamy do PLN kursem rozliczenia; cel w EUR bez
  // kursu uniemożliwia sumowanie (pule, pasek, zdanie z kwotami).
  const summable =
    !data.settled ||
    snapshot.every(
      (goal) => goal.currency === "PLN" || data.settledEurRate !== null,
    );
  const poolAmount = (pool: Pool) =>
    data.settled
      ? sumActualPln(
          snapshot.filter((goal) => goal.pool === pool),
          data.settledEurRate,
        )
      : plan.pools[pool];
  const spend = data.settled
    ? income - poolAmount("savings") - poolAmount("investments")
    : plan.toSpend;

  const groups: PoolGroup[] = [];
  for (const pool of ["savings", "investments"] as const) {
    const items = snapshot
      .filter((goal) => goal.pool === pool)
      .map((goal) =>
        buildItem(goal, planByGoal.get(goal.goalId) ?? 0, data, eurRate),
      );
    if (items.length > 0) {
      groups.push({
        pool,
        title: POOL_TITLE[pool],
        totalLabel: summable ? formatMoney(poolAmount(pool), "PLN") : "—",
        items,
      });
    }
  }

  return {
    settled: data.settled,
    summable,
    setAsideLabel: formatMoney(income - spend, "PLN"),
    toSpendLabel: formatMoney(spend, "PLN"),
    segments: summable
      ? buildSegments(
          poolAmount("savings"),
          poolAmount("investments"),
          spend,
          income,
        )
      : [],
    legend: summable
      ? [
          {
            key: "savings",
            label: "Oszczędności",
            amountLabel: formatMoney(poolAmount("savings"), "PLN"),
          },
          {
            key: "investments",
            label: "Inwestycje",
            amountLabel: formatMoney(poolAmount("investments"), "PLN"),
          },
          {
            key: "spend",
            label: "Do wydania",
            amountLabel: formatMoney(spend, "PLN"),
          },
        ]
      : [],
    groups,
  };
}

/** Suma wpłat celów w PLN; EUR przeliczone kursem rozliczenia (SPEC 6.8). */
function sumActualPln(
  goals: SnapshotGoalRow[],
  settledEurRate: number | null,
): number {
  return goals.reduce((sum, goal) => {
    const actual = goal.actualAmount ?? 0;
    if (goal.currency === "PLN") return sum + actual;
    // `summable` gwarantuje kurs, gdy jest cel w EUR; 0 to tylko zabezpieczenie.
    return sum + (settledEurRate ? convertEurToPln(actual, settledEurRate) : 0);
  }, 0);
}

/** Szerokości pasków w procentach przychodu; zerowe segmenty pomijamy. */
function buildSegments(
  savings: number,
  investments: number,
  spend: number,
  income: number,
): Segment[] {
  const parts = [
    { key: "savings" as const, amount: savings },
    { key: "investments" as const, amount: investments },
    { key: "spend" as const, amount: spend },
  ];
  return parts
    .filter((part) => part.amount > 0)
    .map((part) => {
      const widthPct = (part.amount * 100) / income;
      return { key: part.key, pctLabel: `${Math.round(widthPct)}%`, widthPct };
    });
}

function buildItem(
  goal: SnapshotGoalRow,
  planAmount: number,
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

  const base = {
    goalId: goal.goalId,
    pool: goal.pool,
    name: goal.name,
    sourceName: goal.sourceName,
    pctLabel: formatPercent(goal.pct),
    progress,
  };

  // Rozliczony: główna kwota = wpłata faktyczna w walucie źródła, pod spodem
  // plan w PLN; cel w EUR pokazuje też przelicznik po kursie rozliczenia.
  if (data.settled) {
    const actual = goal.actualAmount ?? 0;
    const amountNote =
      goal.currency === "EUR" && data.settledEurRate !== null
        ? `= ${formatMoney(convertEurToPln(actual, data.settledEurRate), "PLN")}`
        : null;
    return {
      ...base,
      amountLabel: formatMoney(actual, goal.currency),
      amountNote,
      rateLink: false,
      planNote: `plan: ${formatMoney(planAmount, "PLN")}`,
    };
  }

  // Otwarty: główna kwota = plan w PLN; cel w EUR z linią „≈ … €" albo linkiem.
  const isEur = goal.currency === "EUR";
  return {
    ...base,
    amountLabel: formatMoney(planAmount, "PLN"),
    amountNote:
      isEur && eurRate !== null
        ? `≈ ${formatMoney(convertPlnToEur(planAmount, eurRate), "EUR")}`
        : null,
    rateLink: isEur && eurRate === null,
    planNote: null,
  };
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

/**
 * Pigułki zaległych miesięcy nad nagłówkiem, od najstarszego (SPEC 5.5, scen. 7).
 * Każda prowadzi do rozliczenia danego miesiąca; po rozliczeniu miesiąc znika
 * z listy przy kolejnym odczycie.
 */
function OverdueMonths({ months }: { months: string[] }) {
  return (
    <ul className={styles.overdueList} aria-label="Zaległe miesiące">
      {months.map((month) => (
        <li key={month} className={styles.overdue}>
          <span className={styles.overdueDot} aria-hidden="true" />
          <span>{formatMonthTitle(month)} czeka na rozliczenie.</span>
          <Link href={`/rozliczenie/${month}`} className={styles.overdueLink}>
            Rozlicz
          </Link>
        </li>
      ))}
    </ul>
  );
}

function CurrentMonth({
  month,
  data,
  settleHref,
}: {
  month: string;
  data: MonthData | null;
  settleHref: string | null;
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
              income={toIncomeView(income)}
              readOnly={settled}
            />
          ))}
        </ul>
      )}
      {!settled && <AddIncomeForm key="add-income" month={month} />}
      {settleHref !== null && (
        <Link href={settleHref} className={styles.settleLink}>
          Rozlicz miesiąc
        </Link>
      )}
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
