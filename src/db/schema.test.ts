import { randomBytes } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closePool, getPool } from "./client";

afterAll(closePool);

describe("migracja", () => {
  it("na pustej bazie tworzy wszystkie tabele", async () => {
    const name = `byw_migrate_${randomBytes(4).toString("hex")}`;
    await getPool().query(`create database ${name}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${name}`;
    const pool = new Pool({ connectionString: url.toString() });
    try {
      await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
      const { rows } = await pool.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' order by table_name`,
      );
      expect(rows.map((row) => row.table_name)).toEqual([
        "exchange_rates",
        "goals",
        "incomes",
        "login_attempts",
        "month_goals",
        "months",
        "rate_fetches",
        "sessions",
        "settings",
        "source_values",
        "sources",
        "users",
      ]);
    } finally {
      await pool.end();
      await getPool().query(`drop database ${name}`);
    }
  }, 30_000);

  it("historia wartości (0005) na danych MVP zachowuje wartości i dodaje punkt initial każdego źródła", async () => {
    const name = `byw_migrate_${randomBytes(4).toString("hex")}`;
    await getPool().query(`create database ${name}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${name}`;
    const pool = new Pool({ connectionString: url.toString() });
    // Kopia migracji obcięta do stanu MVP (0000–0004).
    const mvp = await mkdtemp(path.join(tmpdir(), "byw-mvp-"));
    try {
      await cp("drizzle", mvp, { recursive: true });
      const journalPath = path.join(mvp, "meta", "_journal.json");
      const journal = JSON.parse(await readFile(journalPath, "utf8"));
      journal.entries = journal.entries.filter(
        (entry: { tag: string }) => entry.tag < "0005",
      );
      await writeFile(journalPath, JSON.stringify(journal));
      await migrate(drizzle(pool), { migrationsFolder: mvp });

      const { rows: accounts } = await pool.query<{ id: number }>(
        `insert into users (email, password_hash)
         values ('a@example.com', 'x'), ('b@example.com', 'x') returning id`,
      );
      await pool.query(
        `insert into sources (user_id, name, kind, currency, value, archived_at)
         values ($1, 'Konto', 'savings', 'PLN', 1234567, null),
                ($1, 'IKE', 'investments', 'EUR', 98765, null),
                ($1, 'Stare', 'savings', 'PLN', 0, now()),
                ($2, 'Inne konto', 'savings', 'PLN', 500, null)`,
        [accounts[0].id, accounts[1].id],
      );
      const sourcesQuery = `select id, user_id, value, currency, archived_at
                            from sources order by id`;
      const { rows: before } = await pool.query(sourcesQuery);

      await migrate(drizzle(pool), { migrationsFolder: "drizzle" });

      expect((await pool.query(sourcesQuery)).rows).toEqual(before);
      const { rows: history } = await pool.query(
        `select source_id, user_id, value, currency, reason
         from source_values order by source_id`,
      );
      expect(history).toEqual(
        before.map((s) => ({
          source_id: s.id,
          user_id: s.user_id,
          value: s.value,
          currency: s.currency,
          reason: "initial",
        })),
      );
    } finally {
      await pool.end();
      await getPool().query(`drop database ${name}`);
      await rm(mvp, { recursive: true, force: true });
    }
  }, 30_000);

  it("kurs rozliczenia (0007) na danych MVP oznacza rozliczony cel EUR jako manual", async () => {
    const name = `byw_migrate_${randomBytes(4).toString("hex")}`;
    await getPool().query(`create database ${name}`);
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${name}`;
    const pool = new Pool({ connectionString: url.toString() });
    // Kopia migracji obcięta do stanu sprzed kursu rozliczenia (0000–0006).
    const pre = await mkdtemp(path.join(tmpdir(), "byw-pre0007-"));
    try {
      await cp("drizzle", pre, { recursive: true });
      const journalPath = path.join(pre, "meta", "_journal.json");
      const journal = JSON.parse(await readFile(journalPath, "utf8"));
      journal.entries = journal.entries.filter(
        (entry: { tag: string }) => entry.tag < "0007",
      );
      await writeFile(journalPath, JSON.stringify(journal));
      await migrate(drizzle(pool), { migrationsFolder: pre });

      const { rows: accounts } = await pool.query<{ id: number }>(
        `insert into users (email, password_hash)
         values ('a@example.com', 'x') returning id`,
      );
      const userId = accounts[0].id;
      await pool.query(
        `insert into months (user_id, month, savings_pct, investments_pct, settled_at, settled_eur_rate)
         values ($1, '2026-08', 2000, 1000, now(), 43000),
                ($1, '2026-09', 2000, 1000, now(), null),
                ($1, '2026-10', 2000, 1000, null, null)`,
        [userId],
      );

      await migrate(drizzle(pool), { migrationsFolder: "drizzle" });

      const { rows } = await pool.query<{
        month: string;
        settled_eur_rate: number | null;
        settled_rate_source: string | null;
        settled_rate_date: string | null;
      }>(
        `select month, settled_eur_rate, settled_rate_source, settled_rate_date
         from months order by month`,
      );
      expect(rows).toEqual([
        {
          month: "2026-08",
          settled_eur_rate: 43000,
          settled_rate_source: "manual",
          settled_rate_date: null,
        },
        {
          month: "2026-09",
          settled_eur_rate: null,
          settled_rate_source: null,
          settled_rate_date: null,
        },
        {
          month: "2026-10",
          settled_eur_rate: null,
          settled_rate_source: null,
          settled_rate_date: null,
        },
      ]);
    } finally {
      await pool.end();
      await getPool().query(`drop database ${name}`);
      await rm(pre, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("ograniczenia schematu", () => {
  // Każdy test działa w transakcji wycofywanej na końcu, więc nie zostawia danych.
  let client: PoolClient;
  let userId: number;
  let otherUserId: number;
  let savingsSourceId: number;
  let investmentsSourceId: number;
  let goalId: number;
  let monthId: number;

  async function one<T>(text: string, values: unknown[] = []): Promise<T> {
    const { rows } = await client.query(text, values);
    return rows[0] as T;
  }

  /** Wykonuje zapytanie w punkcie zapisu i zwraca błąd zgłoszony przez bazę. */
  async function rejection(text: string, values: unknown[] = []) {
    await client.query("savepoint attempt");
    try {
      await client.query(text, values);
    } catch (error) {
      await client.query("rollback to savepoint attempt");
      const { code, constraint } = error as {
        code: string;
        constraint: string;
      };
      return { code, constraint };
    }
    await client.query("rollback to savepoint attempt");
    throw new Error(`Baza przyjęła zapytanie: ${text}`);
  }

  async function createUser(email: string): Promise<number> {
    const { id } = await one<{ id: number }>(
      "insert into users (email, password_hash) values ($1, 'x') returning id",
      [email],
    );
    return id;
  }

  async function createSource(user: number, kind: string, currency = "PLN") {
    const { id } = await one<{ id: number }>(
      `insert into sources (user_id, name, kind, currency, value)
       values ($1, 'Konto', $2, $3, 0) returning id`,
      [user, kind, currency],
    );
    return id;
  }

  beforeEach(async () => {
    client = await getPool().connect();
    await client.query("begin");
    userId = await createUser("ograniczenia@example.com");
    otherUserId = await createUser("inne-konto@example.com");
    savingsSourceId = await createSource(userId, "savings");
    investmentsSourceId = await createSource(userId, "investments", "EUR");
    ({ id: goalId } = await one<{ id: number }>(
      `insert into goals (user_id, pool, name, pct, source_id, position)
       values ($1, 'savings', 'Wakacje', 10000, $2, 0) returning id`,
      [userId, savingsSourceId],
    ));
    ({ id: monthId } = await one<{ id: number }>(
      `insert into months (user_id, month, savings_pct, investments_pct)
       values ($1, '2026-10', 2000, 1000) returning id`,
      [userId],
    ));
  });

  afterEach(async () => {
    await client.query("rollback");
    client.release();
  });

  it("przyjmuje poprawne dane we wszystkich tabelach", async () => {
    await client.query(
      "insert into settings (user_id, eur_rate, savings_pct, investments_pct) values ($1, 42850, 6000, 4000)",
      [userId],
    );
    await client.query(
      `insert into month_goals (month_id, goal_id, pool, pct, source_id, actual_amount)
       values ($1, $2, 'savings', 10000, $3, 0)`,
      [monthId, goalId, savingsSourceId],
    );
    await client.query(
      "insert into incomes (month_id, name, amount) values ($1, 'Pensja', 1)",
      [monthId],
    );
    await client.query(
      `update months set settled_at = now(), settled_eur_rate = 42850,
       settled_rate_source = 'nbp', settled_rate_date = '2026-10-30' where id = $1`,
      [monthId],
    );
  });

  describe("odrzuca ujemne kwoty", () => {
    it.each([
      [
        "wartość źródła",
        "update sources set value = -1 where id = $1",
        "sources_value_check",
      ],
      [
        "kwota docelowa",
        "update goals set target_amount = -1 where source_id = $1",
        "goals_target_amount_check",
      ],
      [
        "kwota startowa",
        "update goals set start_amount = -1 where source_id = $1",
        "goals_start_amount_check",
      ],
    ])("%s", async (_, text, constraint) => {
      expect(await rejection(text, [savingsSourceId])).toEqual({
        code: "23514",
        constraint,
      });
    });

    it("faktyczna kwota rozliczenia", async () => {
      expect(
        await rejection(
          `insert into month_goals (month_id, goal_id, pool, pct, source_id, actual_amount)
           values ($1, $2, 'savings', 10000, $3, -1)`,
          [monthId, goalId, savingsSourceId],
        ),
      ).toEqual({
        code: "23514",
        constraint: "month_goals_actual_amount_check",
      });
    });

    it.each([
      [-1, "incomes_amount_check"],
      [0, "incomes_amount_check"],
    ])("przychód %i", async (amount, constraint) => {
      expect(
        await rejection(
          "insert into incomes (month_id, name, amount) values ($1, 'Pensja', $2)",
          [monthId, amount],
        ),
      ).toEqual({ code: "23514", constraint });
    });
  });

  describe("odrzuca procent poza zakresem", () => {
    it.each([
      [
        "pula w ustawieniach poniżej 0",
        "savings_pct = -1",
        "settings_savings_pct_check",
      ],
      [
        "pula w ustawieniach powyżej 100%",
        "investments_pct = 10001",
        "settings_investments_pct_check",
      ],
      [
        "suma pul powyżej 100%",
        "savings_pct = 6000, investments_pct = 4001",
        "settings_pools_sum_check",
      ],
    ])("%s", async (_, assignment, constraint) => {
      await client.query("insert into settings (user_id) values ($1)", [
        userId,
      ]);
      expect(
        await rejection(
          `update settings set ${assignment} where user_id = $1`,
          [userId],
        ),
      ).toEqual({ code: "23514", constraint });
    });

    it.each([
      [
        "pula miesiąca poniżej 0",
        "savings_pct = -1",
        "months_savings_pct_check",
      ],
      [
        "suma pul miesiąca powyżej 100%",
        "investments_pct = 8001",
        "months_pools_sum_check",
      ],
    ])("%s", async (_, assignment, constraint) => {
      expect(
        await rejection(`update months set ${assignment} where id = $1`, [
          monthId,
        ]),
      ).toEqual({ code: "23514", constraint });
    });

    it.each([0, -1, 10001])("procent celu %i", async (pct) => {
      expect(
        await rejection("update goals set pct = $2 where id = $1", [
          goalId,
          pct,
        ]),
      ).toEqual({ code: "23514", constraint: "goals_pct_check" });
      expect(
        await rejection(
          `insert into month_goals (month_id, goal_id, pool, pct, source_id)
           values ($1, $2, 'savings', $3, $4)`,
          [monthId, goalId, pct, savingsSourceId],
        ),
      ).toEqual({ code: "23514", constraint: "month_goals_pct_check" });
    });
  });

  describe("odrzuca kurs ≤ 0", () => {
    it.each([0, -1])(
      "kurs %i w ustawieniach i przy rozliczeniu",
      async (rate) => {
        expect(
          await rejection(
            "insert into settings (user_id, eur_rate) values ($1, $2)",
            [userId, rate],
          ),
        ).toEqual({ code: "23514", constraint: "settings_eur_rate_check" });
        expect(
          await rejection(
            "update months set settled_at = now(), settled_eur_rate = $2 where id = $1",
            [monthId, rate],
          ),
        ).toEqual({
          code: "23514",
          constraint: "months_settled_eur_rate_check",
        });
      },
    );

    it("kurs rozliczenia bez rozliczenia", async () => {
      expect(
        await rejection(
          "update months set settled_eur_rate = 42850 where id = $1",
          [monthId],
        ),
      ).toEqual({
        code: "23514",
        constraint: "months_settled_eur_rate_settled_check",
      });
    });
  });

  describe("kurs rozliczenia: data, pochodzenie i kurs zapasowy", () => {
    it("przyjmuje rozliczenie z kursem NBP (data) i z kursem zapasowym (bez daty)", async () => {
      await client.query(
        `update months set settled_at = now(), settled_eur_rate = 42650,
         settled_rate_source = 'nbp', settled_rate_date = '2026-10-30' where id = $1`,
        [monthId],
      );
      await client.query(
        `update months set settled_eur_rate = 43000,
         settled_rate_source = 'fallback', settled_rate_date = null where id = $1`,
        [monthId],
      );
    });

    it("odrzuca nieznane pochodzenie kursu", async () => {
      expect(
        await rejection(
          `update months set settled_at = now(), settled_eur_rate = 42650,
           settled_rate_source = 'x' where id = $1`,
          [monthId],
        ),
      ).toEqual({
        code: "23514",
        constraint: "months_settled_rate_source_check",
      });
    });

    it.each([
      ["pochodzenie bez kursu", "settled_rate_source = 'fallback'"],
      ["kurs bez pochodzenia", "settled_at = now(), settled_eur_rate = 42650"],
    ])("odrzuca niespójność: %s", async (_, assignment) => {
      expect(
        await rejection(`update months set ${assignment} where id = $1`, [
          monthId,
        ]),
      ).toEqual({
        code: "23514",
        constraint: "months_settled_rate_source_eur_rate_check",
      });
    });

    it.each([
      [
        "data przy kursie zapasowym",
        "settled_rate_source = 'fallback', settled_rate_date = '2026-10-30'",
      ],
      ["kurs NBP bez daty", "settled_rate_source = 'nbp'"],
    ])("odrzuca niespójność daty: %s", async (_, assignment) => {
      expect(
        await rejection(
          `update months set settled_at = now(), settled_eur_rate = 42650, ${assignment} where id = $1`,
          [monthId],
        ),
      ).toEqual({
        code: "23514",
        constraint: "months_settled_rate_date_check",
      });
    });

    it.each([0, -1])(
      "odrzuca kurs zapasowy %i w ustawieniach",
      async (rate) => {
        expect(
          await rejection(
            "insert into settings (user_id, fallback_eur_rate) values ($1, $2)",
            [userId, rate],
          ),
        ).toEqual({
          code: "23514",
          constraint: "settings_fallback_eur_rate_check",
        });
      },
    );
  });

  describe("miesiące", () => {
    it("odrzuca drugi miesiąc o tym samym YYYY-MM", async () => {
      expect(
        await rejection(
          "insert into months (user_id, month, savings_pct, investments_pct) values ($1, '2026-10', 0, 0)",
          [userId],
        ),
      ).toEqual({ code: "23505", constraint: "months_user_id_month_key" });
    });

    it.each(["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01"])(
      "odrzuca miesiąc w formacie %s",
      async (month) => {
        expect(
          await rejection(
            "insert into months (user_id, month, savings_pct, investments_pct) values ($1, $2, 0, 0)",
            [userId, month],
          ),
        ).toEqual({ code: "23514", constraint: "months_month_check" });
      },
    );

    it("usunięcie miesiąca usuwa jego przychody i migawkę celów", async () => {
      await client.query(
        "insert into month_goals (month_id, goal_id, pool, pct, source_id) values ($1, $2, 'savings', 10000, $3)",
        [monthId, goalId, savingsSourceId],
      );
      await client.query(
        "insert into incomes (month_id, name, amount) values ($1, 'Pensja', 100)",
        [monthId],
      );
      await client.query("delete from months where id = $1", [monthId]);
      const counts = await one<{ goals: string; incomes: string }>(
        `select (select count(*) from month_goals where month_id = $1) as goals,
                (select count(*) from incomes where month_id = $1) as incomes`,
        [monthId],
      );
      expect(counts).toEqual({ goals: "0", incomes: "0" });
    });
  });

  describe("powiązania", () => {
    // Klucze obce między celami, źródłami i migawkami są odroczone (migracja
    // 0001); `set constraints all immediate` sprawdza je od razu.
    async function immediate() {
      await client.query("set constraints all immediate");
    }

    it("odrzuca cel ze źródłem innego konta", async () => {
      const foreignSourceId = await createSource(otherUserId, "savings");
      await immediate();
      expect(
        await rejection(
          `insert into goals (user_id, pool, name, pct, source_id, position)
           values ($1, 'savings', 'Cel', 100, $2, 1)`,
          [userId, foreignSourceId],
        ),
      ).toEqual({ code: "23503", constraint: "goals_source_fk" });
    });

    it("odrzuca twarde usunięcie celu i źródła używanych w migawce", async () => {
      await client.query(
        "insert into month_goals (month_id, goal_id, pool, pct, source_id) values ($1, $2, 'savings', 10000, $3)",
        [monthId, goalId, savingsSourceId],
      );
      await immediate();
      expect(
        await rejection("delete from goals where id = $1", [goalId]),
      ).toEqual({
        code: "23503",
        constraint: "month_goals_goal_id_goals_id_fk",
      });
      expect(
        await rejection("delete from sources where id = $1", [savingsSourceId]),
      ).toMatchObject({ code: "23503" });
    });

    it("pozwala zmienić typ źródła, gdy nie wymaga tego reguła bazy", async () => {
      await client.query("delete from goals where id = $1", [goalId]);
      await client.query(
        "update sources set kind = 'investments' where id = $1",
        [savingsSourceId],
      );
      await immediate();
    });

    it("usunięcie użytkownika usuwa kaskadowo wszystkie jego dane", async () => {
      await client.query("insert into settings (user_id) values ($1)", [
        userId,
      ]);
      await client.query(
        "insert into sessions (id, user_id, expires_at) values ('h', $1, now())",
        [userId],
      );
      await client.query(
        "insert into month_goals (month_id, goal_id, pool, pct, source_id) values ($1, $2, 'savings', 10000, $3)",
        [monthId, goalId, savingsSourceId],
      );
      await client.query(
        "insert into incomes (month_id, name, amount) values ($1, 'Pensja', 100)",
        [monthId],
      );
      await client.query("delete from users where id = $1", [userId]);
      await immediate();
      const left = await one<{ count: string }>(
        `select (select count(*) from settings where user_id = $1)
              + (select count(*) from sessions where user_id = $1)
              + (select count(*) from sources where user_id = $1)
              + (select count(*) from goals where user_id = $1)
              + (select count(*) from months where user_id = $1)
              + (select count(*) from month_goals where month_id = $2)
              + (select count(*) from incomes where month_id = $2) as count`,
        [userId, monthId],
      );
      expect(left).toEqual({ count: "0" });
    });
  });

  describe("archiwizacja źródeł", () => {
    it("odrzuca archiwizację źródła o wartości > 0", async () => {
      await client.query("update sources set value = 1 where id = $1", [
        investmentsSourceId,
      ]);
      expect(
        await rejection(
          "update sources set archived_at = now() where id = $1",
          [investmentsSourceId],
        ),
      ).toEqual({ code: "23514", constraint: "sources_archived_value_check" });
    });

    it("archiwizuje źródło o wartości 0 i nie pozwala potem zwiększyć wartości", async () => {
      await client.query(
        "update sources set archived_at = now() where id = $1",
        [investmentsSourceId],
      );
      expect(
        await rejection("update sources set value = value + 1 where id = $1", [
          investmentsSourceId,
        ]),
      ).toEqual({ code: "23514", constraint: "sources_archived_value_check" });
    });
  });

  describe("wartości słownikowe i nazwy", () => {
    it.each([
      [
        "typ źródła",
        "update sources set kind = 'crypto' where id = $1",
        "sources_kind_check",
      ],
      [
        "waluta źródła",
        "update sources set currency = 'USD' where id = $1",
        "sources_currency_check",
      ],
      [
        "pusta nazwa źródła",
        "update sources set name = '' where id = $1",
        "sources_name_check",
      ],
      [
        "nazwa źródła powyżej 60 znaków",
        `update sources set name = '${"a".repeat(61)}' where id = $1`,
        "sources_name_check",
      ],
    ])("odrzuca: %s", async (_, text, constraint) => {
      expect(await rejection(text, [investmentsSourceId])).toEqual({
        code: "23514",
        constraint,
      });
    });

    it("przyjmuje nazwę z 60 znaków", async () => {
      await client.query("update sources set name = $2 where id = $1", [
        savingsSourceId,
        "ż".repeat(60),
      ]);
    });

    it.each([2001, -5001])(
      "odrzuca stopę zwrotu spoza zakresu (%i)",
      async (rate) => {
        expect(
          await rejection(
            "update sources set expected_return = $2 where id = $1",
            [investmentsSourceId, rate],
          ),
        ).toEqual({
          code: "23514",
          constraint: "sources_expected_return_check",
        });
      },
    );

    it.each([2000, -5000, 650, 0])(
      "przyjmuje stopę zwrotu z zakresu (%i) i null",
      async (rate) => {
        await client.query(
          "update sources set expected_return = $2 where id = $1",
          [savingsSourceId, rate],
        );
      },
    );

    it("odrzuca drugie konto o tym samym adresie e-mail", async () => {
      expect(
        await rejection(
          "insert into users (email, password_hash) values ('ograniczenia@example.com', 'y')",
        ),
      ).toEqual({ code: "23505", constraint: "users_email_unique" });
    });

    it("skrót IP ma tylko konto demo (z czasem wygaśnięcia)", async () => {
      expect(
        await rejection(
          "insert into users (email, password_hash, demo_ip_hash) values ('demo-ip@example.invalid', 'y', 'h')",
        ),
      ).toEqual({ code: "23514", constraint: "users_demo_ip_hash_check" });
      await client.query(
        "insert into users (email, password_hash, demo_expires_at, demo_ip_hash) values ('demo@example.invalid', 'y', now() + interval '1 day', 'h')",
      );
    });
  });

  describe("termin celu", () => {
    it("odrzuca termin bez kwoty docelowej", async () => {
      expect(
        await rejection("update goals set deadline = '2027-06' where id = $1", [
          goalId,
        ]),
      ).toEqual({ code: "23514", constraint: "goals_deadline_target_check" });
    });

    it("odrzuca termin w złym formacie", async () => {
      expect(
        await rejection(
          "update goals set target_amount = 500000, deadline = '2027-6' where id = $1",
          [goalId],
        ),
      ).toEqual({ code: "23514", constraint: "goals_deadline_format_check" });
    });

    it("przyjmuje termin YYYY-MM z kwotą docelową", async () => {
      await client.query(
        "update goals set target_amount = 500000, deadline = '2027-06' where id = $1",
        [goalId],
      );
    });
  });
});
