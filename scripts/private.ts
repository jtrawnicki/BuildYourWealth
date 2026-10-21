import { spawnSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  PRIVATE_ENV_FILE,
  PRIVATE_HOST,
  PRIVATE_PORT,
  parsePrivateDatabase,
  privateProcessEnv,
  type PrivateDatabase,
} from "./private-env";

// Wersja prywatna na komputerze właściciela (STACK 5, AGENTS.md):
//   npm run private:start                    baza w Dockerze, migracje, build, serwer na 127.0.0.1
//   npm run private:set-password -- <email>  konto albo nowe hasło
//   npm run private:dump [-- <plik>]         kopia bazy (pg_dump z kontenera bazy)
// Programy Node uruchamiamy przez `process.execPath`, bez `npm` i powłoki, żeby
// działało tak samo w Windows i bez wstrzykiwania argumentów do powłoki.

const DRIZZLE_KIT = "node_modules/drizzle-kit/bin.cjs";
const NEXT = "node_modules/next/dist/bin/next";
const TSX = "node_modules/tsx/dist/cli.mjs";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) {
    fail(`Nie udało się uruchomić ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function output(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { env, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    fail(
      `Polecenie ${command} ${args.join(" ")} nie powiodło się: ` +
        (result.error?.message ?? result.stderr.trim()),
    );
  }
  return result.stdout.trim();
}

function loadDatabase(): PrivateDatabase {
  if (process.env.VERCEL_ENV) {
    fail("Wersja prywatna nie działa na Vercel.");
  }
  if (!existsSync(PRIVATE_ENV_FILE)) {
    fail(
      `Brak pliku ${PRIVATE_ENV_FILE}. Utwórz go z ${PRIVATE_ENV_FILE}.example (AGENTS.md, „Wersja prywatna”).`,
    );
  }
  try {
    return parsePrivateDatabase(readFileSync(PRIVATE_ENV_FILE, "utf8"));
  } catch (error) {
    fail((error as Error).message);
  }
}

/** Uruchamia kontener bazy i tworzy bazę wersji prywatnej, jeśli jej brakuje. */
function ensureDatabase(db: PrivateDatabase, env: NodeJS.ProcessEnv): void {
  run("docker", ["compose", "up", "-d", "--wait", "db"], env);
  const psql = ["compose", "exec", "-T", "db", "psql", "-U", db.user, "-tAq"];
  const exists = output(
    "docker",
    [
      ...psql,
      "-d",
      "postgres",
      "-c",
      `select 1 from pg_database where datname = '${db.name}'`,
    ],
    env,
  );
  if (exists !== "1") {
    run(
      "docker",
      [...psql, "-d", "postgres", "-c", `create database ${db.name}`],
      env,
    );
    console.log(`Utworzono bazę ${db.name}.`);
  }
}

/** Baza gotowa do pracy: kontener działa, baza istnieje, migracje zastosowane. */
function prepareDatabase(db: PrivateDatabase, env: NodeJS.ProcessEnv): void {
  ensureDatabase(db, env);
  run(process.execPath, [DRIZZLE_KIT, "migrate"], env);
}

function start(db: PrivateDatabase, env: NodeJS.ProcessEnv): void {
  prepareDatabase(db, env);
  run(process.execPath, [NEXT, "build"], env);
  console.log(
    `Wersja prywatna: http://${PRIVATE_HOST}:${PRIVATE_PORT} (Ctrl+C kończy).`,
  );
  run(
    process.execPath,
    [NEXT, "start", "-H", PRIVATE_HOST, "-p", String(PRIVATE_PORT)],
    env,
  );
}

function setPassword(
  db: PrivateDatabase,
  env: NodeJS.ProcessEnv,
  email: string | undefined,
): void {
  if (!email) {
    fail("Podaj adres e-mail: npm run private:set-password -- <email>");
  }
  prepareDatabase(db, env);
  run(process.execPath, [TSX, "scripts/user-set-password.ts", email], env);
}

/** Kopia przez pg_dump z kontenera bazy, więc wersja klienta zawsze pasuje do serwera. */
function dump(
  db: PrivateDatabase,
  env: NodeJS.ProcessEnv,
  target?: string,
): void {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const file = target ?? `backups/byw-private-${stamp}.dump`;
  mkdirSync(dirname(file), { recursive: true });
  const fd = openSync(file, "w", 0o600);
  const result = spawnSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "pg_dump",
      "-U",
      db.user,
      "-d",
      db.name,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
    ],
    { env, stdio: ["ignore", fd, "inherit"] },
  );
  closeSync(fd);
  if (result.error || result.status !== 0) {
    rmSync(file, { force: true });
    fail(
      `Nie udało się zrobić kopii${result.error ? `: ${result.error.message}` : ""}. Czy kontener bazy działa (docker compose up -d db)?`,
    );
  }
  chmodSync(file, 0o600);
  console.log(
    `Zapisano kopię bazy: ${file}. Zawiera prawdziwe dane: przenieś ją na osobny nośnik.`,
  );
}

const [command, argument] = process.argv.slice(2);
const db = loadDatabase();
// Typy Next wymagają NODE_ENV w ProcessEnv; procesy potomne dziedziczą go z powłoki.
const env = privateProcessEnv(process.env, db) as NodeJS.ProcessEnv;

switch (command) {
  case "start":
    start(db, env);
    break;
  case "set-password":
    setPassword(db, env, argument);
    break;
  case "dump":
    dump(db, env, argument);
    break;
  default:
    fail(
      "Użycie: tsx scripts/private.ts start | set-password <email> | dump [plik]",
    );
}
