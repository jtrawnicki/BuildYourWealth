import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hasła", () => {
  it("weryfikuje poprawne hasło i odrzuca błędne", async () => {
    const stored = await hashPassword("poprawne hasło 123");
    expect(await verifyPassword("poprawne hasło 123", stored)).toBe(true);
    expect(await verifyPassword("poprawne haslo 123", stored)).toBe(false);
  });

  it("używa losowej soli i nie zapisuje hasła jawnie", async () => {
    const first = await hashPassword("to samo hasło");
    const second = await hashPassword("to samo hasło");
    expect(first).not.toBe(second);
    expect(first).not.toContain("to samo hasło");
    expect(first).toMatch(/^scrypt\$32768\$8\$1\$/);
  });

  it("odrzuca zapis w nieznanym formacie", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
  });
});
