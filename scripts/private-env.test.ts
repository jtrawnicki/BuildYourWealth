import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePrivateDatabase, privateProcessEnv } from "./private-env";

describe("konfiguracja wersji prywatnej (STACK 5)", () => {
  it("czyta lokalną bazę z .env.private", () => {
    expect(
      parsePrivateDatabase(
        "# komentarz\nDATABASE_URL=postgres://byw:byw@localhost:5432/byw_private\n",
      ),
    ).toEqual({
      url: "postgres://byw:byw@localhost:5432/byw_private",
      name: "byw_private",
      user: "byw",
    });
    expect(
      parsePrivateDatabase("DATABASE_URL=postgres://byw@127.0.0.1/moje_dane")
        .name,
    ).toBe("moje_dane");
  });

  it("odrzuca bazę spoza tego komputera", () => {
    expect(() =>
      parsePrivateDatabase(
        "DATABASE_URL=postgres://u:p@ep-x.eu-central-1.aws.neon.tech/neondb",
      ),
    ).toThrow(/na tym komputerze/);
  });

  it("odrzuca brak adresu, bazę testową i nazwę spoza a-z0-9_", () => {
    expect(() => parsePrivateDatabase("")).toThrow(/Brak DATABASE_URL/);
    expect(() =>
      parsePrivateDatabase("DATABASE_URL=postgres://byw@localhost/byw_test"),
    ).toThrow(/_test/);
    expect(() =>
      parsePrivateDatabase(
        "DATABASE_URL=postgres://byw@localhost/x';drop table users;--",
      ),
    ).toThrow(/tylko a-z/);
    expect(() =>
      parsePrivateDatabase("DATABASE_URL=postgres://localhost/byw_private"),
    ).toThrow(/użytkownika/);
  });

  it("procesy dostają bazę prywatną, tryb private i osobny katalog buildu", () => {
    const db = parsePrivateDatabase(
      "DATABASE_URL=postgres://byw:byw@localhost:5432/byw_private",
    );
    const env = privateProcessEnv(
      {
        DATABASE_URL: "postgres://byw:byw@localhost:5432/byw_dev",
        DATABASE_URL_UNPOOLED: "postgres://inna",
        APP_MODE: "demo",
        PATH: "/bin",
      },
      db,
    );
    expect(env).toEqual({
      DATABASE_URL: "postgres://byw:byw@localhost:5432/byw_private",
      APP_MODE: "private",
      BYW_DIST_DIR: ".next-private",
      PATH: "/bin",
    });
  });
});

describe(".env.private", () => {
  const ALLOWED = new Set([
    "scripts/private-env.ts",
    "scripts/private-env.test.ts",
  ]);
  const SKIP = new Set([
    "node_modules",
    ".git",
    ".next",
    ".next-private",
    "docs",
    "backups",
    "playwright-report",
    "test-results",
  ]);

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (SKIP.has(name) || name.startsWith(".env")) return [];
      const path = dir === "." ? name : join(dir, name).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx|mjs|cjs|js|json|ya?ml|sh)$/.test(name) ? [path] : [];
    });
  }

  it("czytają go wyłącznie skrypty wersji prywatnej", () => {
    const readers = files(".").filter(
      (path) =>
        !ALLOWED.has(path) &&
        /\.env\.private(?!\.example)|PRIVATE_ENV_FILE/.test(
          readFileSync(path, "utf8"),
        ),
    );
    expect(readers).toEqual(["scripts/private.ts"]);
  });
});
