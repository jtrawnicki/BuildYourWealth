import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadTestEnv } from "./test-env";

loadTestEnv();

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
