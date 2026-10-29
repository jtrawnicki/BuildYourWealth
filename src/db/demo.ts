import { randomBytes } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { DemoData } from "@/demo/generate";
import type { Db, Tx } from "./client";
import {
  goals,
  incomes,
  months,
  monthGoals,
  sessions,
  settings,
  sources,
  users,
} from "./schema";
import { changeSourceValue } from "./sources";

// Zapis danych piaskownicy demo i jej cykl życia (SPEC 5.8, STACK 5 „Piaskownice
// demo"). Generator (`src/demo/generate.ts`) nie zna bazy; tutaj zapisujemy jego
// wynik i w jednej transakcji sprzątamy wygasłe piaskownice, sprawdzamy limity,
// tworzymy konto demo i jego sesję. W bazie nigdy nie ma jawnego adresu IP, tylko
// jego skrót (liczy go `src/demo/ip.ts`).

// Limity (SPEC 5.8): najwyżej 10 nowych piaskownic na godzinę z jednego adresu
// i najwyżej 500 aktywnych naraz.
export const MAX_SANDBOXES_PER_IP_PER_HOUR = 10;
export const MAX_ACTIVE_SANDBOXES = 500;

export type SandboxInput = {
  /** HMAC adresu IP (nigdy sam adres). */
  ipHash: string;
  now: Date;
  /** Czas życia piaskownicy w milisekundach (SPEC 5.8: 24 h). */
  ttlMs: number;
  /** Skrót tokenu sesji (jak w `auth/session-store`) do zapisania w bazie. */
  sessionId: string;
  data: DemoData;
};

export type SandboxResult =
  | { status: "ok"; userId: number; expiresAt: Date }
  /** Przekroczono limit nowych piaskownic z tego adresu w ostatniej godzinie. */
  | { status: "too-many-ip" }
  /** Przekroczono limit aktywnych piaskownic naraz. */
  | { status: "overloaded" };

/**
 * Tworzy piaskownicę demo atomowo (STACK 5): sprząta wygasłe, sprawdza limity,
 * zakłada konto demo z czasem wygaśnięcia i skrótem IP, zapisuje dane generatora
 * i sesję. Sesja wygasa razem z piaskownicą (`expiresAt` = `demo_expires_at`).
 */
export async function createSandbox(
  db: Db,
  input: SandboxInput,
): Promise<SandboxResult> {
  const { ipHash, now, ttlMs, sessionId, data } = input;
  const expiresAt = new Date(now.getTime() + ttlMs);
  return db.transaction(async (tx) => {
    // Leniwe sprzątanie: wygasłe piaskownice (kaskada usuwa ich dane i sesje).
    await tx
      .delete(users)
      .where(
        and(
          sql`${users.demoExpiresAt} is not null`,
          lte(users.demoExpiresAt, now),
        ),
      );

    const [active] = await tx
      .select({ count: sql<string>`count(*)` })
      .from(users)
      .where(gt(users.demoExpiresAt, now));
    if (Number(active.count) >= MAX_ACTIVE_SANDBOXES) {
      return { status: "overloaded" };
    }

    // „Nowa w ostatniej godzinie" przy stałym TTL: wygasa po więcej niż
    // (TTL − 1 h) od teraz. Nie wymaga osobnej kolumny z czasem utworzenia.
    const recentThreshold = new Date(now.getTime() + ttlMs - 60 * 60 * 1000);
    const [perIp] = await tx
      .select({ count: sql<string>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.demoIpHash, ipHash),
          gt(users.demoExpiresAt, recentThreshold),
        ),
      );
    if (Number(perIp.count) >= MAX_SANDBOXES_PER_IP_PER_HOUR) {
      return { status: "too-many-ip" };
    }

    const email = `demo-${randomBytes(12).toString("hex")}@demo.invalid`;
    const [user] = await tx
      .insert(users)
      .values({
        email,
        // Losowy ciąg zamiast hasła: logowania hasłem w demo nie ma (SPEC 5.8).
        passwordHash: randomBytes(24).toString("hex"),
        demoExpiresAt: expiresAt,
        demoIpHash: ipHash,
      })
      .returning({ id: users.id });

    await writeDemoData(tx, user.id, data);

    await tx
      .insert(sessions)
      .values({ id: sessionId, userId: user.id, expiresAt });

    return { status: "ok", userId: user.id, expiresAt };
  });
}

/**
 * Zapisuje komplet danych generatora dla konta `userId` (ustawienia, źródła,
 * cele, miesiące, przychody, migawki i historię wartości). Klucze z generatora
 * są mapowane na nadane przez bazę identyfikatory; daty rozliczeń i punktów
 * historii pochodzą z generatora.
 */
export async function writeDemoData(
  tx: Tx,
  userId: number,
  data: DemoData,
): Promise<void> {
  await tx.insert(settings).values({
    userId,
    // Kurs zapasowy demo (SPEC 5.8): bieżący kurs i tak bierze się z NBP, a gdy
    // go brak (piaskownica bez pobrania), z tego kursu. `eur_rate` zostaje dla
    // zgodności wstecz, ale ekranów już nie dotyczy (SPEC 5.9, T19b).
    eurRate: data.eurRate,
    fallbackEurRate: data.eurRate,
    savingsPct: data.savingsPct,
    investmentsPct: data.investmentsPct,
  });

  // Źródła powstają z wartością 0; wartość bieżącą ustawia ostatni punkt
  // historii zapisany przez `changeSourceValue` (STACK 5 „Historia wartości").
  const sourceIds = await tx
    .insert(sources)
    .values(
      data.sources.map((s) => ({
        userId,
        name: s.name,
        kind: s.kind,
        currency: s.currency,
      })),
    )
    .returning({ id: sources.id });
  const sourceIdByKey = new Map(
    data.sources.map((s, i) => [s.key, sourceIds[i].id]),
  );
  for (const point of data.history) {
    await changeSourceValue(
      tx,
      userId,
      sourceIdByKey.get(point.sourceKey)!,
      { value: point.value },
      point.reason,
      point.recordedAt,
    );
  }

  const goalIds = await tx
    .insert(goals)
    .values(
      data.goals.map((g) => ({
        userId,
        pool: g.pool,
        name: g.name,
        pct: g.pct,
        sourceId: sourceIdByKey.get(g.sourceKey)!,
        targetAmount: g.targetAmount,
        startAmount: g.startAmount,
        position: g.position,
      })),
    )
    .returning({ id: goals.id });
  const goalIdByKey = new Map(data.goals.map((g, i) => [g.key, goalIds[i].id]));
  const goalByKey = new Map(data.goals.map((g) => [g.key, g]));

  for (const month of data.months) {
    const [row] = await tx
      .insert(months)
      .values({
        userId,
        month: month.month,
        savingsPct: month.savingsPct,
        investmentsPct: month.investmentsPct,
        settledAt: month.settledAt,
        settledEurRate: month.settledEurRate,
        // Kursy rozliczeń demo zawsze jako kurs zapasowy (SPEC Z16, scen. 34).
        settledRateSource: month.settledRateSource,
      })
      .returning({ id: months.id });

    if (month.incomes.length > 0) {
      await tx.insert(incomes).values(
        month.incomes.map((inc) => ({
          monthId: row.id,
          name: inc.name,
          amount: inc.amount,
        })),
      );
    }

    await tx.insert(monthGoals).values(
      month.goals.map((mg) => {
        const goal = goalByKey.get(mg.goalKey)!;
        return {
          monthId: row.id,
          goalId: goalIdByKey.get(mg.goalKey)!,
          pool: goal.pool,
          pct: goal.pct,
          sourceId: sourceIdByKey.get(goal.sourceKey)!,
          actualAmount: mg.actualAmount,
        };
      }),
    );
  }
}
