import { spawnSync } from "node:child_process";
import { resolveAppMode } from "@/demo/mode";

// Polecenie budowania na Vercel (uruchamiane przez `npm run vercel-build`).
// Najpierw sprawdza tryb aplikacji (na Vercel tylko demo, STACK 5), potem na
// produkcji stosuje migracje i buduje aplikację. Na innych środowiskach
// (podglądy) migracje się nie uruchamiają — patrz STACK 6.

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

try {
  resolveAppMode(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

if (process.env.VERCEL_ENV === "production") {
  run("npm", ["run", "db:migrate"]);
}
run("npm", ["run", "build"]);
