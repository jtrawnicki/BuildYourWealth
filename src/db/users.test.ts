import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { verifyPassword } from "@/auth/password";
import { closePool, getDb } from "./client";
import { sessions, settings, users } from "./schema";
import { setUserPassword } from "./users";

const db = getDb();
const created: string[] = [];

function newEmail(): string {
  const email = `owner-${randomUUID()}@example.com`;
  created.push(email);
  return email;
}

async function findUsers(email: string) {
  return db.select().from(users).where(eq(users.email, email));
}

afterAll(async () => {
  for (const email of created) {
    await db.delete(users).where(eq(users.email, email));
  }
  await closePool();
});

describe("setUserPassword", () => {
  it("tworzy konto z ustawieniami domyślnymi", async () => {
    const email = newEmail();
    expect(await setUserPassword(db, email, "pierwsze hasło")).toEqual({
      created: true,
    });
    const [user] = await findUsers(email);
    expect(await verifyPassword("pierwsze hasło", user.passwordHash)).toBe(
      true,
    );
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, user.id));
    expect(userSettings).toEqual({
      userId: user.id,
      eurRate: null,
      savingsPct: 0,
      investmentsPct: 0,
    });
  });

  it("drugie wywołanie zmienia hasło zamiast tworzyć drugie konto", async () => {
    const email = newEmail();
    await setUserPassword(db, email, "pierwsze hasło");
    const [before] = await findUsers(email);
    await db
      .update(settings)
      .set({ eurRate: 43000 })
      .where(eq(settings.userId, before.id));

    expect(
      await setUserPassword(db, email.toUpperCase(), "drugie hasło!"),
    ).toEqual({
      created: false,
    });

    const after = await findUsers(email);
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(before.id);
    expect(await verifyPassword("drugie hasło!", after[0].passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword("pierwsze hasło", after[0].passwordHash)).toBe(
      false,
    );
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, before.id));
    expect(userSettings.eurRate).toBe(43000);
  });

  it("zmiana hasła unieważnia sesje konta", async () => {
    const email = newEmail();
    await setUserPassword(db, email, "pierwsze hasło");
    const [user] = await findUsers(email);
    await db.insert(sessions).values({
      id: randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await setUserPassword(db, email, "drugie hasło!");

    expect(
      await db.select().from(sessions).where(eq(sessions.userId, user.id)),
    ).toEqual([]);
  });

  it("zapisuje e-mail bez spacji i małymi literami", async () => {
    const email = newEmail();
    await setUserPassword(db, `  ${email.toUpperCase()} `, "pierwsze hasło");
    expect(await findUsers(email)).toHaveLength(1);
  });

  it("odrzuca niepoprawny e-mail i zbyt krótkie hasło", async () => {
    await expect(
      setUserPassword(db, "bez-malpy", "pierwsze hasło"),
    ).rejects.toThrow("Niepoprawny adres e-mail");
    await expect(setUserPassword(db, newEmail(), "krótkie")).rejects.toThrow(
      "co najmniej 12 znaków",
    );
  });
});
