import { spawnSync } from "node:child_process";

// Polecenie budowania na Vercel (uruchamiane przez `npm run vercel-build`).
// Na produkcji najpierw stosuje migracje, potem buduje aplikację. Na innych
// środowiskach (podglądy) migracje się nie uruchamiają — patrz STACK 6.

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.VERCEL_ENV === "production") {
  run("npm", ["run", "db:migrate"]);
}
run("npm", ["run", "build"]);
