import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clientIp, hashIp, ipSecret } from "./ip";

describe("skrót adresu IP demo (SPEC 5.8, T16)", () => {
  it("bierze pierwszy adres z x-forwarded-for", () => {
    expect(clientIp("1.2.3.4, 10.0.0.1")).toBe("1.2.3.4");
    expect(clientIp("  5.6.7.8  ")).toBe("5.6.7.8");
  });

  it("zwraca unknown przy braku nagłówka", () => {
    expect(clientIp(null)).toBe("unknown");
    expect(clientIp("")).toBe("unknown");
  });

  it("liczy HMAC-SHA-256 z sekretem, a nie zapisuje adresu", () => {
    const expected = createHmac("sha256", "sekret")
      .update("1.2.3.4")
      .digest("hex");
    const hash = hashIp("1.2.3.4", "sekret");
    expect(hash).toBe(expected);
    expect(hash).not.toContain("1.2.3.4");
    // Ten sam adres i sekret → ten sam skrót; inny sekret → inny skrót.
    expect(hashIp("1.2.3.4", "sekret")).toBe(hash);
    expect(hashIp("1.2.3.4", "inny")).not.toBe(hash);
  });

  it("wymaga sekretu DEMO_IP_SECRET", () => {
    expect(() => ipSecret({})).toThrow(/DEMO_IP_SECRET/);
    expect(ipSecret({ DEMO_IP_SECRET: "x" })).toBe("x");
  });
});
