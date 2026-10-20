import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { verifyPassword } from "@/auth/password";
import { closePool, getPool } from "@/db/client";
import { afterAll, describe, expect, it } from "vitest";

const email = `wlasciciel-${randomBytes(4).toString("hex")}@example.com`;

function setPassword(address: string, password: string) {
  const result = spawnSync(
    "node_modules/.bin/tsx",
    ["scripts/user-set-password.ts", address],
    { input: `${password}\n`, encoding: "utf8", env: process.env },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

async function accounts() {
  const { rows } = await getPool().query<{ id: number; password_hash: string }>(
    "select id, password_hash from users where email = $1",
    [email],
  );
  return rows;
}

describe("npm run user:set-password", () => {
  afterAll(async () => {
    await getPool().query("delete from users where email = $1", [email]);
    await closePool();
  });

  it("tworzy konto, a drugie uruchomienie zmienia hasło zamiast tworzyć drugie konto", async () => {
    const first = setPassword(email, "pierwsze hasło 1");
    expect(first).toEqual({ status: 0, output: `Utworzono konto ${email}.\n` });
    const [created] = await accounts();
    await getPool().query(
      "insert into sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')",
      [randomBytes(32).toString("hex"), created.id],
    );

    const second = setPassword(` ${email.toUpperCase()} `, "drugie hasło 22");
    expect(second.status).toBe(0);
    expect(second.output).toContain(`Ustawiono nowe hasło dla ${email}`);

    const rows = await accounts();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(created.id);
    expect(await verifyPassword("drugie hasło 22", rows[0].password_hash)).toBe(
      true,
    );
    expect(
      await verifyPassword("pierwsze hasło 1", rows[0].password_hash),
    ).toBe(false);

    const { rows: sessions } = await getPool().query(
      "select 1 from sessions where user_id = $1",
      [created.id],
    );
    expect(sessions).toEqual([]);
    const { rows: settings } = await getPool().query(
      "select savings_pct, investments_pct, eur_rate from settings where user_id = $1",
      [created.id],
    );
    expect(settings).toEqual([
      { savings_pct: 0, investments_pct: 0, eur_rate: null },
    ]);
  });

  it("odrzuca krótkie hasło i brak adresu bez zmian w bazie", async () => {
    const other = `krotkie-${randomBytes(4).toString("hex")}@example.com`;
    expect(setPassword(other, "za krótkie")).toEqual({
      status: 1,
      output: "Hasło musi mieć co najmniej 12 znaków.\n",
    });
    expect(setPassword("", "dostatecznie długie")).toMatchObject({ status: 1 });
    const { rows } = await getPool().query(
      "select 1 from users where email = $1",
      [other],
    );
    expect(rows).toEqual([]);
  });
});
