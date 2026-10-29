import { afterEach, describe, expect, it, vi } from "vitest";
import { savePlanAction } from "./actions";
import { PLAN_MESSAGES, type GoalDraft, type PlanDraft } from "./state";

const getSessionUser = vi.hoisted(() => vi.fn());
const savePlan = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session", () => ({ getSessionUser }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/plan", () => ({ savePlan }));
vi.mock("next/cache", () => ({ refresh }));

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of [getSessionUser, savePlan, refresh]) mock.mockReset();
});

const USER = { id: 7, email: "test@example.com" };

const goal = (over: Partial<GoalDraft> = {}): GoalDraft => ({
  id: null,
  pool: "savings",
  name: "Poduszka",
  pct: "100",
  sourceId: "3",
  target: "",
  start: "",
  ...over,
});

const draft = (over: Partial<PlanDraft> = {}): PlanDraft => ({
  savingsPct: "20",
  investmentsPct: "0",
  goals: [goal()],
  ...over,
});

function form(plan: PlanDraft | string): FormData {
  const data = new FormData();
  data.set("plan", typeof plan === "string" ? plan : JSON.stringify(plan));
  return data;
}

const PREV = {};

describe("bez sesji akcja przekierowuje i nic nie zapisuje (scen. 13)", () => {
  it("przekierowuje", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(savePlanAction(PREV, form(draft()))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(savePlan).not.toHaveBeenCalled();
  });
});

describe("walidacja ładunku", () => {
  it("odrzuca niepoprawny JSON", async () => {
    getSessionUser.mockResolvedValue(USER);
    expect(await savePlanAction(PREV, form("nie-json"))).toEqual({
      formError: PLAN_MESSAGES.invalid,
    });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it("odrzuca błędny procent puli, nie wołając savePlan", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await savePlanAction(
      PREV,
      form(draft({ savingsPct: "120" })),
    );
    expect(result).toEqual({ formError: PLAN_MESSAGES.invalid });
    expect(savePlan).not.toHaveBeenCalled();
  });

  it("odrzuca plan z sumą celów ≠ 100% (scen. 3)", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await savePlanAction(
      PREV,
      form(
        draft({
          goals: [
            goal({ name: "A", pct: "60" }),
            goal({ name: "B", pct: "30" }),
          ],
        }),
      ),
    );
    expect(result).toEqual({ formError: PLAN_MESSAGES.invalid });
    expect(savePlan).not.toHaveBeenCalled();
  });
});

describe("zapis", () => {
  it("parsuje pola na liczby całkowite i woła savePlan", async () => {
    getSessionUser.mockResolvedValue(USER);
    savePlan.mockResolvedValue({ status: "ok" });
    const result = await savePlanAction(
      PREV,
      form(
        draft({
          savingsPct: "20",
          investmentsPct: "0",
          goals: [
            goal({
              id: 5,
              name: " Wakacje ",
              pct: "33,33",
              sourceId: "9",
              target: "1 000,00",
              start: "",
            }),
            goal({ name: "Reszta", pct: "66,67", sourceId: "9" }),
          ],
        }),
      ),
    );
    expect(result).toEqual({ saved: true });
    expect(refresh).toHaveBeenCalled();
    expect(savePlan).toHaveBeenCalledWith({}, USER.id, {
      savingsPct: 2000,
      investmentsPct: 0,
      goals: [
        {
          id: 5,
          pool: "savings",
          name: "Wakacje",
          pct: 3333,
          sourceId: 9,
          targetAmount: 100000,
          startAmount: null,
          deadline: null,
        },
        {
          id: null,
          pool: "savings",
          name: "Reszta",
          pct: 6667,
          sourceId: 9,
          targetAmount: null,
          startAmount: null,
          deadline: null,
        },
      ],
    });
  });

  it("zgłasza brak źródła z nazwą celu i odświeża", async () => {
    getSessionUser.mockResolvedValue(USER);
    savePlan.mockResolvedValue({
      status: "source-missing",
      goalName: "Poduszka",
    });
    const result = await savePlanAction(PREV, form(draft()));
    expect(result).toEqual({
      formError: PLAN_MESSAGES.sourceMissing("Poduszka"),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("zgłasza blokadę zmiany waluty (SPEC 6.9)", async () => {
    getSessionUser.mockResolvedValue(USER);
    savePlan.mockResolvedValue({
      status: "currency-locked",
      goalName: "Poduszka",
    });
    const result = await savePlanAction(PREV, form(draft()));
    expect(result).toEqual({
      formError: PLAN_MESSAGES.currencyLocked("Poduszka"),
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("zgłasza nieaktualny plan i odświeża", async () => {
    getSessionUser.mockResolvedValue(USER);
    savePlan.mockResolvedValue({ status: "stale" });
    expect(await savePlanAction(PREV, form(draft()))).toEqual({
      formError: PLAN_MESSAGES.stale,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("przy błędzie zapisu zwraca saveFailed", async () => {
    getSessionUser.mockResolvedValue(USER);
    savePlan.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await savePlanAction(PREV, form(draft()))).toEqual({
      saveFailed: true,
    });
  });
});
