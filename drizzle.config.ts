import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./scripts/load-env";

loadEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Migracje używają adresu bezpośredniego, gdy jest ustawiony
  // (`DATABASE_URL_UNPOOLED` w produkcji na Vercel); lokalnie i w CI
  // wystarcza `DATABASE_URL`.
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
});
