import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// `.env` jak w Next.js; zmienna `DATABASE_URL` z powłoki ma pierwszeństwo.
loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
