import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getMonth, getMonthSnapshot, type MonthData } from "@/db/months";
import { resolveSettlementRate } from "@/rates/settlement-rate";
import type { ChosenRate } from "@/rates/select";
import { now } from "@/domain/clock";
import { convertEurToPln } from "@/domain/currency";
import { formatAmount, formatMoney } from "@/domain/format";
import { formatMonthTitle } from "@/domain/month-name";
import { computeMonthPlan, type Pool } from "@/domain/plan";
import { plannedActual } from "@/domain/settlement";
import { canSettleMonth } from "@/domain/time";
import {
  SettleForm,
  type SettleGroupView,
  type SettleView,
} from "./SettleForm";
import styles from "./page.module.css";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Trasa dynamiczna (`[miesiac]`) i tak wymaga sesji oraz danych z bazy, a wspólna
// nawigacja używa `usePathname()`, którego nie da się prerenderować bez znanej
// ścieżki. Renderujemy ją więc w czasie żądania (za granicą `loading.tsx` grupy),
// zamiast budować pusty szkielet (Cache Components).
export const instant = false;

const POOL_TITLE: Record<Pool, string> = {
  savings: "Oszczędności",
  investments: "Inwestycje",
};

// Ekran rozliczenia miesiąca (makieta B2, SPEC 5.5). Dwie opcje (plan albo
// faktyczne kwoty), transakcja w `db/settlement.ts`. Dostępny od ostatniego dnia
// miesiąca; rozliczony miesiąc i brak kursu przy celu EUR mają własne widoki.
export default async function SettlePage({
  params,
}: PageProps<"/rozliczenie/[miesiac]">) {
  const user = await requireUser();
  const { miesiac } = await params;
  if (!MONTH_PATTERN.test(miesiac)) notFound();

  const db = getDb();
  const data = await getMonth(db, user.id, miesiac);
  // Rozliczyć można tylko istniejący miesiąc z przychodem (SPEC 5.4, 5.5).
  if (data === null || data.incomes.length === 0) notFound();
  if (data.settled) return <Info month={miesiac} message="alreadySettled" />;
  if (!canSettleMonth(miesiac, now())) {
    return <Info month={miesiac} message="notAvailable" />;
  }

  const snapshot = await getMonthSnapshot(db, data.id);
  // Kurs rozliczenia (reguła 6.10) tylko dla miesiąca z celem EUR; brak kursu
  // (NBP i zapasowego) blokuje rozliczenie i prosi o kurs zapasowy (SPEC 5.5).
  const hasEur = snapshot.some((goal) => goal.currency === "EUR");
  let rate: ChosenRate | null = null;
  if (hasEur) {
    rate = await resolveSettlementRate(db, user.id, miesiac, now());
    if (rate === null) return <Info month={miesiac} message="noRate" />;
  }
  const rateValue = rate?.rate ?? null;

  return (
    <SettleForm
      view={buildView(data, snapshot, rateValue)}
      eurRate={rateValue}
      rate={rate}
    />
  );
}

type SnapshotGoal = Awaited<ReturnType<typeof getMonthSnapshot>>[number];

const goalCount = new Intl.PluralRules("pl-PL");
const GOAL_FORMS = { one: "cel", few: "cele", many: "celów" } as const;
function goalCountLabel(count: number): string {
  const form = goalCount.select(count) as keyof typeof GOAL_FORMS;
  return `${count} ${GOAL_FORMS[form] ?? GOAL_FORMS.many}`;
}

/** Składa widok formularza rozliczenia z migawki miesiąca i planu (SPEC 5.5). */
function buildView(
  data: MonthData,
  snapshot: SnapshotGoal[],
  eurRate: number | null,
): SettleView {
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
  const rateHint =
    eurRate !== null
      ? "Kwota w euro po kursie rozliczenia; możesz poprawić."
      : null;

  const groups: SettleGroupView[] = [];
  let planSum = 0;
  let settleTotal = 0;
  for (const pool of ["savings", "investments"] as const) {
    const poolGoals = snapshot.filter((goal) => goal.pool === pool);
    if (poolGoals.length === 0) continue;
    let poolPlan = 0;
    const items = poolGoals.map((goal) => {
      const planPln = planByGoal.get(goal.goalId) ?? 0;
      const actual = plannedActual(planPln, goal.currency, eurRate);
      poolPlan += planPln;
      planSum += planPln;
      // „Trafi łącznie": kwota faktyczna sprowadzona z powrotem do PLN (EUR ≈).
      settleTotal +=
        goal.currency === "PLN" ? planPln : convertEurToPln(actual, eurRate!);
      return {
        goalId: goal.goalId,
        name: goal.name,
        sourceName: goal.sourceName,
        currency: goal.currency,
        planLabel: formatMoney(planPln, "PLN"),
        actualField: formatAmount(actual),
        eurHint: goal.currency === "EUR" ? rateHint : null,
      };
    });
    groups.push({
      pool,
      title: POOL_TITLE[pool],
      totalPlanLabel: formatMoney(poolPlan, "PLN"),
      items,
    });
  }

  return {
    month: data.month,
    monthTitle: formatMonthTitle(data.month),
    incomeLabel: formatMoney(income, "PLN"),
    planSumLabel: formatMoney(planSum, "PLN"),
    planTotalLabel: formatMoney(settleTotal, "PLN"),
    goalCountLabel: goalCountLabel(snapshot.length),
    hasEur: snapshot.some((goal) => goal.currency === "EUR"),
    groups,
  };
}

const INFO: Record<string, string> = {
  alreadySettled: "Ten miesiąc jest już rozliczony.",
  notAvailable: "Rozliczenie będzie dostępne od ostatniego dnia miesiąca.",
  noRate:
    "Nie udało się ustalić kursu z NBP. Ustaw kurs zapasowy w Ustawieniach, żeby rozliczyć cel w euro.",
};

/** Widok zastępczy, gdy rozliczenia nie da się teraz pokazać (SPEC 5.5, 7). */
function Info({
  month,
  message,
}: {
  month: string;
  message: keyof typeof INFO;
}) {
  return (
    <section className={styles.infoCard}>
      <h1 className={styles.title}>Rozliczenie · {formatMonthTitle(month)}</h1>
      <p className={styles.infoText}>{INFO[message]}</p>
      <div className={styles.infoLinks}>
        <Link href="/" className={styles.back}>
          Wróć do „Ten miesiąc”
        </Link>
        {message === "noRate" && (
          <Link href="/ustawienia" className={styles.back}>
            Ustaw kurs zapasowy
          </Link>
        )}
      </div>
    </section>
  );
}
