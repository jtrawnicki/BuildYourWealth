import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/domain/input";
import { saveEurRate } from "./actions";

const getSessionUser = vi.hoisted(() => vi.fn());
const setEurRate = vi.hoisted(() => vi.fn());
vi.mock("@/auth/session", () => ({ getSessionUser }));
vi.mock("@/db/client", () => ({ getDb: () => ({}) }));
vi.mock("@/db/settings", () => ({ setEurRate }));

afterEach(() => {
  vi.restoreAllMocks();
  getSessionUser.mockReset();
  setEurRate.mockReset();
});

function form(eurRate: string): FormData {
  const data = new FormData();
  data.set("eurRate", eurRate);
  return data;
}

const USER = { id: 7, email: "test@example.com" };

describe("zapis kursu EUR", () => {
  it("bez sesji przekierowuje na logowanie i niczego nie zapisuje (scen. 13)", async () => {
    getSessionUser.mockResolvedValue(null);
    await expect(saveEurRate({ input: "" }, form("4,2850"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(setEurRate).not.toHaveBeenCalled();
  });

  it("zapisuje kurs w dziesięciotysięcznych", async () => {
    getSessionUser.mockResolvedValue(USER);
    expect(await saveEurRate({ input: "" }, form("4,2850"))).toEqual({
      input: "4,2850",
      saved: true,
    });
    expect(setEurRate).toHaveBeenCalledWith({}, USER.id, 42850);
  });

  it.each(["", "0", "4,28501", "abc"])(
    "odrzuca „%s” komunikatem z SPEC 7.1 i zostawia wpis",
    async (input) => {
      getSessionUser.mockResolvedValue(USER);
      expect(await saveEurRate({ input: "" }, form(input))).toEqual({
        input,
        fieldError: MESSAGES.eurRate,
      });
      expect(setEurRate).not.toHaveBeenCalled();
    },
  );

  it("przy błędzie zapisu zgłasza błąd i zostawia wpis (SPEC 7)", async () => {
    getSessionUser.mockResolvedValue(USER);
    setEurRate.mockRejectedValue(new Error("connection terminated"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await saveEurRate({ input: "" }, form("4,30"))).toEqual({
      input: "4,30",
      saveFailed: true,
    });
  });
});
