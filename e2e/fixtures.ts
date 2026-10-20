import { test as base, expect } from "@playwright/test";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE } from "@/auth/constants";
import { getDb } from "@/db/client";
import { sources } from "@/db/schema";
import {
  TEST_EMAIL,
  createSessionToken,
  createTestUser,
  resetDatabase,
} from "./db";

type SourceInput = {
  name: string;
  kind: "savings" | "investments";
  currency?: "PLN" | "EUR";
  value?: number;
};

/** Helper seedujący dane użytkownika przez `db/` (rozwijany w kolejnych zadaniach). */
export type Seed = {
  userId: number;
  addSource(input: SourceInput): Promise<number>;
  countSources(): Promise<number>;
};

function makeSeed(userId: number): Seed {
  return {
    userId,
    async addSource({ name, kind, currency = "PLN", value = 0 }) {
      const [row] = await getDb()
        .insert(sources)
        .values({ userId, name, kind, currency, value })
        .returning({ id: sources.id });
      return row.id;
    },
    async countSources() {
      const rows = await getDb()
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.userId, userId));
      return rows.length;
    },
  };
}

/**
 * Fixture „zalogowany użytkownik na czystej bazie”: czyści bazę, tworzy konto
 * testowe i ustawia ciasteczko sesji dla każdego testu (SPEC 12, T3).
 * `authUserId` ma `auto: true`, więc każdy test z tego modułu jest zalogowany.
 */
export const test = base.extend<{ authUserId: number; seed: Seed }>({
  authUserId: [
    async ({ page, baseURL }, provide) => {
      await resetDatabase();
      const userId = await createTestUser();
      const token = await createSessionToken(userId);
      await page.context().addCookies([
        {
          name: SESSION_COOKIE,
          value: token,
          url: baseURL!,
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ]);
      await provide(userId);
    },
    { auto: true },
  ],
  seed: async ({ authUserId }, provide) => {
    await provide(makeSeed(authUserId));
  },
});

export { expect, TEST_EMAIL };
