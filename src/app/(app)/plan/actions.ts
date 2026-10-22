"use server";
import { refresh } from "next/cache";
import { requireUser } from "@/auth/guard";
import { getDb } from "@/db/client";
import { savePlan, type PlanGoalInput, type PlanInput } from "@/db/plan";
import {
  parseGoalPercent,
  parseName,
  parseOptionalAmount,
  parsePoolPercent,
} from "@/domain/input";
import { validatePlan } from "@/domain/plan";
import { SAVE_ERROR_MESSAGE } from "@/ui/SaveError";
import {
  PLAN_MESSAGES,
  type GoalDraft,
  type PlanDraft,
  type PlanState,
} from "./state";

const POOLS = ["savings", "investments"] as const;

function parseDraft(raw: string): PlanDraft | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.savingsPct !== "string" ||
    typeof draft.investmentsPct !== "string" ||
    !Array.isArray(draft.goals)
  ) {
    return null;
  }
  const goals: GoalDraft[] = [];
  for (const item of draft.goals) {
    if (typeof item !== "object" || item === null) return null;
    const g = item as Record<string, unknown>;
    if (
      (g.id !== null && typeof g.id !== "number") ||
      (POOLS as readonly string[]).includes(g.pool as string) === false ||
      typeof g.name !== "string" ||
      typeof g.pct !== "string" ||
      typeof g.sourceId !== "string" ||
      typeof g.target !== "string" ||
      typeof g.start !== "string"
    ) {
      return null;
    }
    goals.push(g as GoalDraft);
  }
  return {
    savingsPct: draft.savingsPct,
    investmentsPct: draft.investmentsPct,
    goals,
  };
}

/** Parsuje ładunek funkcjami z `domain` i sprawdza reguły planu (SPEC 6–7). */
function toInput(draft: PlanDraft): PlanInput | null {
  const savings = parsePoolPercent(draft.savingsPct);
  const investments = parsePoolPercent(draft.investmentsPct);
  if (!savings.ok || !investments.ok) return null;

  const goals: PlanGoalInput[] = [];
  for (const draftGoal of draft.goals) {
    const name = parseName(draftGoal.name);
    const pct = parseGoalPercent(draftGoal.pct);
    const target = parseOptionalAmount(draftGoal.target);
    const start = parseOptionalAmount(draftGoal.start);
    const sourceId = Number(draftGoal.sourceId);
    if (
      !name.ok ||
      !pct.ok ||
      !target.ok ||
      !start.ok ||
      !Number.isSafeInteger(sourceId) ||
      sourceId <= 0
    ) {
      return null;
    }
    goals.push({
      id: draftGoal.id,
      pool: draftGoal.pool,
      name: name.value,
      pct: pct.value,
      sourceId,
      targetAmount: target.value,
      startAmount: start.value,
    });
  }

  const issues = validatePlan({
    savingsPct: savings.value,
    investmentsPct: investments.value,
    goals: goals.map((g) => ({ pool: g.pool, pct: g.pct })),
  });
  if (issues.length > 0) return null;

  return {
    savingsPct: savings.value,
    investmentsPct: investments.value,
    goals,
  };
}

export async function savePlanAction(
  _prev: PlanState,
  formData: FormData,
): Promise<PlanState> {
  const user = await requireUser();
  const draft = parseDraft(String(formData.get("plan") ?? ""));
  if (!draft) return { formError: PLAN_MESSAGES.invalid };
  const input = toInput(draft);
  if (!input) return { formError: PLAN_MESSAGES.invalid };

  let result;
  try {
    result = await savePlan(getDb(), user.id, input);
  } catch (error) {
    // Błąd zapisu lub budzącej się bazy (SPEC 7): dane zostają w formularzu.
    console.error(SAVE_ERROR_MESSAGE, error);
    return { saveFailed: true };
  }

  switch (result.status) {
    case "source-missing":
      refresh();
      return { formError: PLAN_MESSAGES.sourceMissing(result.goalName) };
    case "currency-locked":
      return { formError: PLAN_MESSAGES.currencyLocked(result.goalName) };
    case "stale":
      refresh();
      return { formError: PLAN_MESSAGES.stale };
    case "ok":
      refresh();
      return { saved: true };
  }
}
