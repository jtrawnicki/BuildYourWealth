import { afterEach, describe, expect, it, vi } from "vitest";
import { INVALID_CREDENTIALS_MESSAGE } from "@/auth/constants";
import { login } from "./actions";

const getDb = vi.hoisted(() => vi.fn());
// Akcja w trybie demo nie może sięgnąć do bazy.
vi.mock("@/db/client", () => ({ getDb }));

afterEach(() => {
  vi.unstubAllEnvs();
  getDb.mockReset();
});

function form(email: string, password: string): FormData {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}

describe("logowanie w trybie demo (SPEC 5.8, scen. 21)", () => {
  it("odrzuca logowanie hasłem bez sięgania do bazy", async () => {
    vi.stubEnv("APP_MODE", "demo");
    expect(
      await login({}, form("wlasciciel@example.com", "haslo-1234567")),
    ).toEqual({ error: INVALID_CREDENTIALS_MESSAGE });
    expect(getDb).not.toHaveBeenCalled();
  });
});
