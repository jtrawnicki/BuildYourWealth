import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/domain/input";
import { addSource, archiveSourceAction, editSource } from "./actions";
import { EMPTY_SOURCE, SOURCE_MESSAGES, type SourceFormValues } from "./state";

const getSessionUser = vi.hoisted(() => vi.fn());
const createSource = vi.hoisted(() => vi.fn());
const updateSource = vi.hoisted(() => vi.fn());
const archiveSource = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session", () => ({ getSessionUser }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/sources", () => ({ createSource, updateSource, archiveSource }));
vi.mock("next/cache", () => ({ refresh }));

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of [
    getSessionUser,
    createSource,
    updateSource,
    archiveSource,
    refresh,
  ]) {
    mock.mockReset();
  }
});

const USER = { id: 7, email: "test@example.com" };

const VALID: SourceFormValues = {
  name: "  Konto EUR ",
  kind: "investments",
  currency: "EUR",
  value: "1 234,56",
  note: " ",
  excluded: "",
  expectedReturn: "",
};

function form(values: Partial<SourceFormValues> & { id?: string }): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const PREV = { values: EMPTY_SOURCE };

describe("bez sesji akcje przekierowują i niczego nie zapisują (scen. 13)", () => {
  it.each([
    ["dodanie", () => addSource(PREV, form(VALID))],
    ["edycja", () => editSource(PREV, form({ ...VALID, id: "1" }))],
    ["archiwizacja", () => archiveSourceAction({}, form({ id: "1" }))],
  ])("%s", async (_name, run) => {
    getSessionUser.mockResolvedValue(null);
    await expect(run()).rejects.toThrow("NEXT_REDIRECT");
    expect(createSource).not.toHaveBeenCalled();
    expect(updateSource).not.toHaveBeenCalled();
    expect(archiveSource).not.toHaveBeenCalled();
  });
});

describe("dodanie źródła", () => {
  it("zapisuje kwotę w groszach, nazwę bez spacji i pustą notatkę jako brak", async () => {
    getSessionUser.mockResolvedValue(USER);
    expect(await addSource(PREV, form(VALID))).toEqual({
      values: EMPTY_SOURCE,
      saved: true,
    });
    expect(createSource).toHaveBeenCalledWith({}, USER.id, {
      name: "Konto EUR",
      kind: "investments",
      currency: "EUR",
      value: 123456,
      note: null,
      excludedFromNetWorth: false,
      expectedReturn: null,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("odrzuca błędne pola komunikatami z SPEC 7.1 i zostawia wpis", async () => {
    getSessionUser.mockResolvedValue(USER);
    const values = { ...VALID, name: "", value: "-5", currency: "USD" };
    expect(await addSource(PREV, form(values))).toEqual({
      values,
      errors: {
        name: MESSAGES.name,
        value: MESSAGES.amount,
        kind: SOURCE_MESSAGES.kind,
      },
    });
    expect(createSource).not.toHaveBeenCalled();
  });

  it("przy błędzie zapisu zgłasza błąd i zostawia wpis (SPEC 7)", async () => {
    getSessionUser.mockResolvedValue(USER);
    createSource.mockRejectedValue(new Error("connection terminated"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await addSource(PREV, form(VALID))).toEqual({
      values: VALID,
      saveFailed: true,
    });
  });
});

describe("edycja źródła", () => {
  it("zapisuje zmiany źródła o podanym id", async () => {
    getSessionUser.mockResolvedValue(USER);
    updateSource.mockResolvedValue("ok");
    expect(await editSource(PREV, form({ ...VALID, id: "5" }))).toEqual({
      values: VALID,
      saved: true,
    });
    expect(updateSource).toHaveBeenCalledWith({}, USER.id, 5, {
      name: "Konto EUR",
      kind: "investments",
      currency: "EUR",
      value: 123456,
      note: null,
      excludedFromNetWorth: false,
      expectedReturn: null,
    });
  });

  it("zaznaczone „Nie wliczaj do majątku” zapisuje wykluczenie (P35)", async () => {
    getSessionUser.mockResolvedValue(USER);
    updateSource.mockResolvedValue("ok");
    await editSource(PREV, form({ ...VALID, excluded: "on", id: "5" }));
    expect(updateSource).toHaveBeenCalledWith(
      {},
      USER.id,
      5,
      expect.objectContaining({ excludedFromNetWorth: true }),
    );
  });

  it.each([
    ["kind-locked", SOURCE_MESSAGES.kindLocked],
    ["not-found", SOURCE_MESSAGES.notFound],
  ])("wynik %s daje komunikat i zostawia wpis", async (result, message) => {
    getSessionUser.mockResolvedValue(USER);
    updateSource.mockResolvedValue(result);
    expect(await editSource(PREV, form({ ...VALID, id: "5" }))).toEqual({
      values: VALID,
      formError: message,
    });
  });

  it("odrzuca niepoprawne id bez zapisu", async () => {
    getSessionUser.mockResolvedValue(USER);
    expect(
      (await editSource(PREV, form({ ...VALID, id: "abc" }))).formError,
    ).toBe(SOURCE_MESSAGES.notFound);
    expect(updateSource).not.toHaveBeenCalled();
  });
});

describe("archiwizacja źródła", () => {
  it.each([
    ["ok", {}],
    ["has-value", { formError: SOURCE_MESSAGES.hasValue }],
    ["in-use", { formError: SOURCE_MESSAGES.inUse }],
    ["not-found", { formError: SOURCE_MESSAGES.notFound }],
  ])("wynik %s", async (result, state) => {
    getSessionUser.mockResolvedValue(USER);
    archiveSource.mockResolvedValue(result);
    expect(await archiveSourceAction({}, form({ id: "3" }))).toEqual(state);
    expect(archiveSource).toHaveBeenCalledWith({}, USER.id, 3);
  });

  it("przy błędzie zapisu zgłasza błąd (SPEC 7)", async () => {
    getSessionUser.mockResolvedValue(USER);
    archiveSource.mockRejectedValue(new Error("connection terminated"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await archiveSourceAction({}, form({ id: "3" }))).toEqual({
      saveFailed: true,
    });
  });
});
