import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Zmienna z powłoki (np. adres bazy produkcyjnej) ma pierwszeństwo przed `.env`.
loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
