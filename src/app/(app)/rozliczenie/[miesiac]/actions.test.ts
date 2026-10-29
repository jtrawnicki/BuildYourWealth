import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/domain/input";
import { settleAction } from "./actions";
import { SETTLE_MESSAGES } from "./state";

const getSessionUser = vi.hoisted(() => vi.fn());
const settleMonth = vi.hoisted(() => vi.fn());
const monthHasEurGoal = vi.hoisted(() => vi.fn());
const resolveSettlementRate = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session", () => ({ getSessionUser }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/settlement", () => ({ settleMonth, monthHasEurGoal }));
// Czysty `sameChosenRate` zostaje prawdziwy; podmieniamy tylko pobranie kursu.
vi.mock("@/rates/settlement-rate", async (orig) => ({
  ...(await orig<typeof import("@/rates/settlement-rate")>()),
  resolveSettlementRate,
}));
vi.mock("next/cache", () => ({ refresh }));
// Stały „teraz": 31.10.2026, więc 2026-10 można rozliczyć, 2026-11 jeszcze nie.
vi.mock("@/domain/clock", () => ({
  now: () => new Date("2026-10-31T12:00:00Z"),
}));

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of [
    getSessionUser,
    settleMonth,
    monthHasEurGoal,
    resolveSettlementRate,
    refresh,
  ]) {
    mock.mockReset();
  }
  // Domyślnie miesiąc istnieje bez celu EUR: ścieżka kursu się nie uruchamia.
  monthHasEurGoal.mockResolvedValue({ exists: true, hasEur: false });
});

const USER = { id: 7, email: "test@example.com" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const actuals = (list: { goalId: number; amount: string }[]) =>
  JSON.stringify(list);

describe("bez sesji akcja przekierowuje i nic nie zapisuje (scen. 13)", () => {
  it("settleAction", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(
      settleAction({}, form({ month: "2026-10", mode: "plan" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(settleMonth).not.toHaveBeenCalled();
  });
});

describe("walidacja wejścia", () => {
  it("odrzuca niepoprawny klucz miesiąca bez wołania bazy", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await settleAction(
      {},
      form({ month: "2026-13", mode: "plan" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.notFound);
    expect(settleMonth).not.toHaveBeenCalled();
  });

  it("odrzuca miesiąc przed ostatnim dniem (niedostępny)", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await settleAction(
      {},
      form({ month: "2026-11", mode: "plan" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.notAvailable);
    expect(settleMonth).not.toHaveBeenCalled();
  });

  it("odrzuca nieznany tryb", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await settleAction(
      {},
      form({ month: "2026-10", mode: "x" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.invalid);
    expect(settleMonth).not.toHaveBeenCalled();
  });

  it("odrzuca niepoprawny ładunek kwot w trybie ręcznym", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await settleAction(
      {},
      form({ month: "2026-10", mode: "manual", actuals: "nie-json" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.invalid);
    expect(settleMonth).not.toHaveBeenCalled();
  });

  it("zgłasza błędy pól przy niepoprawnej kwocie, bez wołania bazy", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await settleAction(
      {},
      form({
        month: "2026-10",
        mode: "manual",
        actuals: actuals([
          { goalId: 3, amount: "100" },
          { goalId: 4, amount: "" },
        ]),
      }),
    );
    expect(result.errors).toEqual({ "4": MESSAGES.actualRequired });
    expect(settleMonth).not.toHaveBeenCalled();
  });
});

describe("zatwierdzenie rozliczenia", () => {
  it("woła settleMonth w trybie plan i przekierowuje po sukcesie", async () => {
    getSessionUser.mockResolvedValue(USER);
    settleMonth.mockResolvedValue({ status: "ok" });
    await expect(
      settleAction({}, form({ month: "2026-10", mode: "plan" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(settleMonth).toHaveBeenCalledWith(
      {},
      USER.id,
      "2026-10",
      { mode: "plan" },
      null,
    );
  });

  it("parsuje kwoty i woła settleMonth w trybie ręcznym", async () => {
    getSessionUser.mockResolvedValue(USER);
    settleMonth.mockResolvedValue({ status: "ok" });
    await expect(
      settleAction(
        {},
        form({
          month: "2026-10",
          mode: "manual",
          actuals: actuals([
            { goalId: 3, amount: "500" },
            { goalId: 4, amount: "0" },
          ]),
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(settleMonth).toHaveBeenCalledWith(
      {},
      USER.id,
      "2026-10",
      {
        mode: "manual",
        actuals: [
          { goalId: 3, amount: 50000 },
          { goalId: 4, amount: 0 },
        ],
      },
      null,
    );
  });

  it("zgłasza już rozliczony miesiąc i odświeża (scen. 15)", async () => {
    getSessionUser.mockResolvedValue(USER);
    settleMonth.mockResolvedValue({ status: "already-settled" });
    const result = await settleAction(
      {},
      form({ month: "2026-10", mode: "plan" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.alreadySettled);
    expect(refresh).toHaveBeenCalled();
  });

  it("zgłasza brak kursu przy celu EUR, bez wołania bazy", async () => {
    getSessionUser.mockResolvedValue(USER);
    monthHasEurGoal.mockResolvedValue({ exists: true, hasEur: true });
    resolveSettlementRate.mockResolvedValue(null);
    const result = await settleAction(
      {},
      form({ month: "2026-10", mode: "plan" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.noRate);
    expect(settleMonth).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("rozlicza cel EUR po kursie pokazanym na ekranie", async () => {
    getSessionUser.mockResolvedValue(USER);
    monthHasEurGoal.mockResolvedValue({ exists: true, hasEur: true });
    const rate = { source: "nbp", rate: 42650, date: "2026-10-30" } as const;
    resolveSettlementRate.mockResolvedValue(rate);
    settleMonth.mockResolvedValue({ status: "ok" });
    await expect(
      settleAction(
        {},
        form({
          month: "2026-10",
          mode: "plan",
          rate: "42650",
          rateSource: "nbp",
          rateDate: "2026-10-30",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(settleMonth).toHaveBeenCalledWith(
      {},
      USER.id,
      "2026-10",
      { mode: "plan" },
      rate,
    );
  });

  it("odrzuca zapis, gdy kurs rozliczenia się zmienił (scen. 36)", async () => {
    getSessionUser.mockResolvedValue(USER);
    monthHasEurGoal.mockResolvedValue({ exists: true, hasEur: true });
    // Ekran pokazał tabelę z 27.11; przed zatwierdzeniem pojawiła się z 30.11.
    resolveSettlementRate.mockResolvedValue({
      source: "nbp",
      rate: 42500,
      date: "2026-11-30",
    });
    const result = await settleAction(
      {},
      form({
        month: "2026-10",
        mode: "plan",
        rate: "42600",
        rateSource: "nbp",
        rateDate: "2026-11-27",
      }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.rateChanged);
    expect(settleMonth).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("przy błędzie zapisu zwraca saveFailed", async () => {
    getSessionUser.mockResolvedValue(USER);
    settleMonth.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await settleAction(
      {},
      form({ month: "2026-10", mode: "plan" }),
    );
    expect(result.saveFailed).toBe(true);
  });
});
