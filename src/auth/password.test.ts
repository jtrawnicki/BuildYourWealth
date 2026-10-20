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

  it("odrzuca uszkodzony zapis zamiast przepuścić dowolne hasło", async () => {
    const valid = await hashPassword("hasło");
    const [, , , , salt, hash] = valid.split("$");
    const damaged = [
      `scrypt$32768$8$1$${salt}$`,
      `scrypt$32768$8$1$${salt}$!!!`,
      `scrypt$32768$8$1$${salt}$=`,
      `scrypt$32768$8$1$AAAA$${hash}`,
      `scrypt$32768$8$1$${salt}$${hash.slice(0, 10)}`,
      `scrypt$32768$8$1$${salt}$${hash}$extra`,
    ];
    for (const stored of damaged) {
      expect(await verifyPassword("dowolne", stored), stored).toBe(false);
    }
  });

  it("odrzuca zapis z innymi parametrami scrypt bez ich wykonywania", async () => {
    const valid = await hashPassword("hasło");
    const [, , , , salt, hash] = valid.split("$");
    for (const params of ["1048576$8$1", "3$8$1", "32768$8$2", "x$8$1"]) {
      expect(
        await verifyPassword("hasło", `scrypt$${params}$${salt}$${hash}`),
      ).toBe(false);
    }
  });
});
