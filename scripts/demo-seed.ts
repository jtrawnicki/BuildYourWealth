import { eq } from "drizzle-orm";
import { closePool, getDb } from "@/db/client";
import { writeDemoData } from "@/db/demo";
import { goals, months, settings, sources } from "@/db/schema";
import { findUserByEmail, normalizeEmail } from "@/db/users";
import { generateDemoData } from "@/demo/generate";
import { loadEnv } from "./load-env";

// Użycie: npm run demo:seed -- <email>
// Zapisuje dane generatora dla istniejącego konta w `byw_dev` (ręczne oglądanie
// ekranów demo podczas pracy). Odmawia pracy na bazie `byw_private` (STACK 5).

/** Nazwa bazy z `DATABASE_URL`; pusta, gdy adresu nie da się sparsować. */
function databaseName(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

async function main(): Promise<void> {
  loadEnv();
  if (databaseName(process.env.DATABASE_URL) === "byw_private") {
    throw new Error("demo:seed nie działa na bazie byw_private (STACK 5).");
  }

  const email = process.argv[2];
  if (!email) {
    throw new Error("Podaj adres e-mail: npm run demo:seed -- <email>");
  }
  const normalized = normalizeEmail(email);
  const db = getDb();
  const user = await findUserByEmail(db, normalized);
  if (!user) {
    throw new Error(
      `Nie ma konta ${normalized}. Najpierw: npm run user:set-password -- ${normalized}`,
    );
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // Czyścimy poprzednie dane konta (zostawiamy konto i sesje) i zapisujemy
    // świeży zestaw, żeby skrypt można było uruchomić wielokrotnie.
    await tx.delete(months).where(eq(months.userId, user.id));
    await tx.delete(goals).where(eq(goals.userId, user.id));
    await tx.delete(sources).where(eq(sources.userId, user.id));
    await tx.delete(settings).where(eq(settings.userId, user.id));
    await writeDemoData(tx, user.id, generateDemoData(now, Math.random));
  });
  console.log(`Zapisano dane demo dla ${normalized}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
