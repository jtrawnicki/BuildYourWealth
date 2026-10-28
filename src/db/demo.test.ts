import { randomBytes } from "node:crypto";
import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { generateDemoData } from "@/demo/generate";
import { closePool, getDb } from "./client";
import {
  MAX_ACTIVE_SANDBOXES,
  MAX_SANDBOXES_PER_IP_PER_HOUR,
  createSandbox,
} from "./demo";
import {
  goals,
  months,
  sessions,
  settings,
  sources,
  sourceValues,
  users,
} from "./schema";

afterAll(closePool);

const NOW = new Date("2026-10-25T12:00:00Z");
const TTL_MS = 24 * 60 * 60 * 1000;

function data() {
  // Deterministyczna losowość wystarczy; zawartość danych sprawdza generate.test.
  return generateDemoData(NOW, () => 0.5);
}

function sandboxInput(
  overrides: Partial<Parameters<typeof createSandbox>[1]> = {},
) {
  return {
    ipHash: "ip-hash-a",
    now: NOW,
    ttlMs: TTL_MS,
    sessionId: randomBytes(16).toString("hex"),
    data: data(),
    ...overrides,
  };
}

/** Wstawia aktywne konta demo wprost, żeby szybko zbudować stan limitów. */
async function insertActiveSandboxes(
  count: number,
  ipHash: string | null,
): Promise<void> {
  const expiresAt = new Date(NOW.getTime() + TTL_MS);
  const rows = Array.from({ length: count }, () => ({
    email: `demo-${randomBytes(8).toString("hex")}@demo.invalid`,
    passwordHash: randomBytes(8).toString("hex"),
    demoExpiresAt: expiresAt,
    demoIpHash: ipHash,
  }));
  await getDb().insert(users).values(rows);
}

afterEach(async () => {
  // Każdy test sprząta po sobie konta demo (kaskada usuwa dane i sesje).
  await getDb().delete(users).where(isNotNull(users.demoExpiresAt));
});

describe("piaskownice demo (SPEC 5.8, T16)", () => {
  it("tworzy konto demo z danymi, sesją wygasającą z piaskownicą i skrótem IP", async () => {
    const sessionId = randomBytes(16).toString("hex");
    const result = await createSandbox(
      getDb(),
      sandboxInput({ ipHash: "ip-hash-x", sessionId }),
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + TTL_MS);

    const [user] = await getDb()
      .select({
        demoExpiresAt: users.demoExpiresAt,
        demoIpHash: users.demoIpHash,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, result.userId));
    expect(user.demoIpHash).toBe("ip-hash-x");
    expect(user.demoExpiresAt?.getTime()).toBe(NOW.getTime() + TTL_MS);
    expect(user.email).toMatch(/@demo\.invalid$/);

    const [session] = await getDb()
      .select({ expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(session.expiresAt.getTime()).toBe(NOW.getTime() + TTL_MS);

    // Dane zapisane: ustawienia, źródła, cele i miesiące.
    const count = async (
      table: typeof sources | typeof goals | typeof months,
    ) => {
      const [row] = await getDb()
        .select({ n: sql<string>`count(*)` })
        .from(table)
        .where(eq(table.userId, result.userId));
      return Number(row.n);
    };
    expect(await count(sources)).toBeGreaterThan(0);
    expect(await count(goals)).toBeGreaterThan(0);
    expect(await count(months)).toBeGreaterThan(0);
    const [setting] = await getDb()
      .select({ eurRate: settings.eurRate })
      .from(settings)
      .where(eq(settings.userId, result.userId));
    expect(setting.eurRate).toBeGreaterThan(0);
  });

  it("w bazie jest tylko skrót adresu, nigdy jawny adres IP", async () => {
    const result = await createSandbox(
      getDb(),
      sandboxInput({ ipHash: "hashed-1-2-3-4" }),
    );
    if (result.status !== "ok") throw new Error("spodziewano się ok");
    const [user] = await getDb()
      .select({ demoIpHash: users.demoIpHash })
      .from(users)
      .where(eq(users.id, result.userId));
    // Przechowywany jest wyłącznie przekazany skrót (hashowanie robi demo/ip.ts).
    expect(user.demoIpHash).toBe("hashed-1-2-3-4");
  });

  it("sprząta wygasłe piaskownice przy wejściu", async () => {
    const [expired] = await getDb()
      .insert(users)
      .values({
        email: `demo-${randomBytes(8).toString("hex")}@demo.invalid`,
        passwordHash: "x",
        demoExpiresAt: new Date(NOW.getTime() - 1000),
        demoIpHash: "ip-hash-old",
      })
      .returning({ id: users.id });

    const result = await createSandbox(getDb(), sandboxInput());
    expect(result.status).toBe("ok");

    const remaining = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, expired.id));
    expect(remaining).toHaveLength(0);
  });

  it("odrzuca kolejne wejście po limicie z jednego adresu w godzinie", async () => {
    await insertActiveSandboxes(MAX_SANDBOXES_PER_IP_PER_HOUR, "ip-hash-limit");
    const result = await createSandbox(
      getDb(),
      sandboxInput({ ipHash: "ip-hash-limit" }),
    );
    expect(result.status).toBe("too-many-ip");

    // Inny adres nie jest zablokowany.
    const other = await createSandbox(
      getDb(),
      sandboxInput({ ipHash: "ip-hash-inny" }),
    );
    expect(other.status).toBe("ok");
  });

  it("odrzuca wejście po limicie aktywnych piaskownic", async () => {
    await insertActiveSandboxes(MAX_ACTIVE_SANDBOXES, null);
    const result = await createSandbox(
      getDb(),
      sandboxInput({ ipHash: "ip-hash-nowy" }),
    );
    expect(result.status).toBe("overloaded");
  });
});

describe("historia wartości piaskownicy (SPEC 5.8, 5.11, T17)", () => {
  it("zapisuje historię i daty rozliczeń z generatora; wartość źródła = ostatni punkt", async () => {
    const input = sandboxInput();
    const result = await createSandbox(getDb(), input);
    if (result.status !== "ok") throw new Error(result.status);

    const points = await getDb()
      .select({
        name: sources.name,
        value: sourceValues.value,
        currency: sourceValues.currency,
        reason: sourceValues.reason,
        recordedAt: sourceValues.recordedAt,
      })
      .from(sourceValues)
      .innerJoin(sources, eq(sources.id, sourceValues.sourceId))
      .where(eq(sourceValues.userId, result.userId))
      .orderBy(asc(sourceValues.id));
    const nameOf = new Map(input.data.sources.map((s) => [s.key, s]));
    expect(points).toEqual(
      input.data.history.map((p) => ({
        name: nameOf.get(p.sourceKey)!.name,
        value: p.value,
        currency: nameOf.get(p.sourceKey)!.currency,
        reason: p.reason,
        recordedAt: p.recordedAt,
      })),
    );

    const stored = await getDb()
      .select({ name: sources.name, value: sources.value })
      .from(sources)
      .where(eq(sources.userId, result.userId));
    for (const s of input.data.sources) {
      expect(stored.find((r) => r.name === s.name)?.value).toBe(s.value);
    }

    const settled = await getDb()
      .select({ month: months.month, settledAt: months.settledAt })
      .from(months)
      .where(eq(months.userId, result.userId));
    for (const m of input.data.months) {
      expect(settled.find((r) => r.month === m.month)?.settledAt).toEqual(
        m.settledAt,
      );
    }
  });
});
