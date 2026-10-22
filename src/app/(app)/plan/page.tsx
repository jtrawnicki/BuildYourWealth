import type { Metadata } from "next";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { getPlan, listPlanSources } from "@/db/plan";
import { PlanForm } from "./PlanForm";

export const metadata: Metadata = {
  title: "Plan podziału — BuildYourWealth",
};

export default async function PlanPage() {
  const user = await requireUser();
  const db = getDb();
  const [plan, sources] = await Promise.all([
    getPlan(db, user.id),
    listPlanSources(db, user.id),
  ]);

  return <PlanForm initial={plan} sources={sources} />;
}
