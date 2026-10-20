import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hasła", () => {
  it("weryfikuje poprawne hasło i odrzuca błędne", async () => {
    const hash = await hashPassword("poprawne hasło 123");
    expect(await verifyPassword("poprawne hasło 123", hash)).toBe(true);
    expect(await verifyPassword("poprawne hasło 124", hash)).toBe(false);
  });

  it("nie zapisuje hasła jawnie i używa losowej soli", async () => {
    const first = await hashPassword("to samo hasło");
    const second = await hashPassword("to samo hasło");
    expect(first).not.toContain("to samo hasło");
    expect(first).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(first).not.toBe(second);
  });

  it("odrzuca zapis w nieznanym formacie", async () => {
    expect(await verifyPassword("hasło", "")).toBe(false);
    expect(await verifyPassword("hasło", "bcrypt$abc")).toBe(false);
  });
});
