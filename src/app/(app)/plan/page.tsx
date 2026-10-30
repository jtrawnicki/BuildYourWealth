import type { Metadata } from "next";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { listHistory } from "@/db/months";
import { getPlan, listPlanSources } from "@/db/plan";
import { now } from "@/domain/clock";
import { currentMonth } from "@/domain/time";
import { resolveCurrentRate } from "@/rates/current-rate";
import { PlanForm, type ForecastContext } from "./PlanForm";

export const metadata: Metadata = {
  title: "Plan podziału — BuildYourWealth",
};

export default async function PlanPage() {
  const user = await requireUser();
  const db = getDb();
  const [plan, sources, history, rate] = await Promise.all([
    getPlan(db, user.id),
    listPlanSources(db, user.id),
    listHistory(db, user.id),
    resolveCurrentRate(db, user.id, now()),
  ]);
  // Do klienta tylko to, czego potrzebuje prognoza celu (SPEC 5.12).
  const context: ForecastContext = {
    months: history.map((m) => ({
      month: m.month,
      settled: m.settled,
      income: m.income,
      savingsPct: m.savingsPct,
      investmentsPct: m.investmentsPct,
      goals: m.goals.map((g) => ({
        goalId: g.goalId,
        pool: g.pool,
        pct: g.pct,
        actualAmount: g.actualAmount,
      })),
    })),
    currentMonth: currentMonth(now()),
    currentRate: rate?.rate ?? null,
  };

  return <PlanForm initial={plan} sources={sources} context={context} />;
}
