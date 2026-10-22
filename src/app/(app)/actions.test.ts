import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/domain/input";
import {
  addIncomeAction,
  deleteIncomeAction,
  editIncomeAction,
} from "./actions";
import { INCOME_MESSAGES } from "./state";

const getSessionUser = vi.hoisted(() => vi.fn());
const addIncome = vi.hoisted(() => vi.fn());
const updateIncome = vi.hoisted(() => vi.fn());
const deleteIncome = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session", () => ({ getSessionUser }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/months", () => ({ addIncome, updateIncome, deleteIncome }));
vi.mock("next/cache", () => ({ refresh }));

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of [
    getSessionUser,
    addIncome,
    updateIncome,
    deleteIncome,
    refresh,
  ]) {
    mock.mockReset();
  }
});

const USER = { id: 7, email: "test@example.com" };
const PREV = { values: { name: "", amount: "" } };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const addForm = (over: Record<string, string> = {}) =>
  form({ month: "2026-10", name: "Pensja", amount: "8 500", ...over });
const editForm = (over: Record<string, string> = {}) =>
  form({ id: "5", name: "Pensja", amount: "8 500", ...over });

describe("bez sesji akcje przekierowują i nic nie zapisują (scen. 13)", () => {
  it("addIncomeAction", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(addIncomeAction(PREV, addForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(addIncome).not.toHaveBeenCalled();
  });

  it("editIncomeAction", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(editIncomeAction(PREV, editForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(updateIncome).not.toHaveBeenCalled();
  });

  it("deleteIncomeAction", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(deleteIncomeAction({}, form({ id: "5" }))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(deleteIncome).not.toHaveBeenCalled();
  });
});

describe("dodanie przychodu", () => {
  it("odrzuca niepoprawny klucz miesiąca bez wołania bazy", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await addIncomeAction(PREV, addForm({ month: "2026-13" }));
    expect(result.formError).toBe(INCOME_MESSAGES.cannotCreate);
    expect(addIncome).not.toHaveBeenCalled();
  });

  it("odrzuca pustą nazwę i kwotę ≤ 0, zachowując wpis", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await addIncomeAction(
      PREV,
      addForm({ name: "  ", amount: "0" }),
    );
    expect(result.errors).toEqual({
      name: MESSAGES.name,
      amount: MESSAGES.incomePositive,
    });
    expect(result.values).toEqual({ name: "  ", amount: "0" });
    expect(addIncome).not.toHaveBeenCalled();
  });

  it("parsuje pola i woła addIncome z bieżącym czasem", async () => {
    getSessionUser.mockResolvedValue(USER);
    addIncome.mockResolvedValue({ status: "ok", monthId: 1, created: true });
    const result = await addIncomeAction(PREV, addForm({ amount: "1 234,56" }));
    expect(result.saved).toBe(true);
    expect(refresh).toHaveBeenCalled();
    expect(addIncome).toHaveBeenCalledWith(
      {},
      USER.id,
      "2026-10",
      { name: "Pensja", amount: 123456 },
      expect.any(Date),
    );
  });

  it("zgłasza miesiąc, którego nie wolno utworzyć, bez odświeżania", async () => {
    getSessionUser.mockResolvedValue(USER);
    addIncome.mockResolvedValue({ status: "cannot-create" });
    const result = await addIncomeAction(PREV, addForm({ month: "2026-01" }));
    expect(result.formError).toBe(INCOME_MESSAGES.cannotCreate);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("zgłasza rozliczony miesiąc i odświeża", async () => {
    getSessionUser.mockResolvedValue(USER);
    addIncome.mockResolvedValue({ status: "settled" });
    const result = await addIncomeAction(PREV, addForm());
    expect(result.formError).toBe(INCOME_MESSAGES.settled);
    expect(refresh).toHaveBeenCalled();
  });

  it("przy błędzie zapisu zwraca saveFailed", async () => {
    getSessionUser.mockResolvedValue(USER);
    addIncome.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await addIncomeAction(PREV, addForm());
    expect(result.saveFailed).toBe(true);
  });
});

describe("edycja przychodu", () => {
  it("odrzuca brak id bez wołania bazy", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await editIncomeAction(PREV, editForm({ id: "0" }));
    expect(result.formError).toBe(INCOME_MESSAGES.notFound);
    expect(updateIncome).not.toHaveBeenCalled();
  });

  it("woła updateIncome i odświeża", async () => {
    getSessionUser.mockResolvedValue(USER);
    updateIncome.mockResolvedValue("ok");
    const result = await editIncomeAction(PREV, editForm({ amount: "900" }));
    expect(result.saved).toBe(true);
    expect(updateIncome).toHaveBeenCalledWith({}, USER.id, 5, {
      name: "Pensja",
      amount: 90000,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("zgłasza rozliczony miesiąc", async () => {
    getSessionUser.mockResolvedValue(USER);
    updateIncome.mockResolvedValue("settled");
    const result = await editIncomeAction(PREV, editForm());
    expect(result.formError).toBe(INCOME_MESSAGES.settled);
  });
});

describe("usunięcie przychodu", () => {
  it("odrzuca brak id bez wołania bazy", async () => {
    getSessionUser.mockResolvedValue(USER);
    const result = await deleteIncomeAction({}, form({ id: "x" }));
    expect(result.formError).toBe(INCOME_MESSAGES.notFound);
    expect(deleteIncome).not.toHaveBeenCalled();
  });

  it("woła deleteIncome i odświeża", async () => {
    getSessionUser.mockResolvedValue(USER);
    deleteIncome.mockResolvedValue({ status: "ok", monthRemoved: true });
    const result = await deleteIncomeAction({}, form({ id: "5" }));
    expect(result).toEqual({});
    expect(deleteIncome).toHaveBeenCalledWith({}, USER.id, 5);
    expect(refresh).toHaveBeenCalled();
  });

  it("zgłasza rozliczony miesiąc", async () => {
    getSessionUser.mockResolvedValue(USER);
    deleteIncome.mockResolvedValue({ status: "settled" });
    const result = await deleteIncomeAction({}, form({ id: "5" }));
    expect(result.formError).toBe(INCOME_MESSAGES.settled);
  });
});
