import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/domain/input";
import { settleAction } from "./actions";
import { SETTLE_MESSAGES } from "./state";

const getSessionUser = vi.hoisted(() => vi.fn());
const settleMonth = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session", () => ({ getSessionUser }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/settlement", () => ({ settleMonth }));
vi.mock("next/cache", () => ({ refresh }));
// Stały „teraz": 31.10.2026, więc 2026-10 można rozliczyć, 2026-11 jeszcze nie.
vi.mock("@/domain/clock", () => ({
  now: () => new Date("2026-10-31T12:00:00Z"),
}));

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of [getSessionUser, settleMonth, refresh]) mock.mockReset();
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
    expect(settleMonth).toHaveBeenCalledWith({}, USER.id, "2026-10", {
      mode: "plan",
    });
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
    expect(settleMonth).toHaveBeenCalledWith({}, USER.id, "2026-10", {
      mode: "manual",
      actuals: [
        { goalId: 3, amount: 50000 },
        { goalId: 4, amount: 0 },
      ],
    });
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

  it("zgłasza brak kursu przy celu EUR", async () => {
    getSessionUser.mockResolvedValue(USER);
    settleMonth.mockResolvedValue({ status: "no-rate" });
    const result = await settleAction(
      {},
      form({ month: "2026-10", mode: "plan" }),
    );
    expect(result.formError).toBe(SETTLE_MESSAGES.noRate);
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
