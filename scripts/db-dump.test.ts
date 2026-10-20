import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Atrapa pg_dump: zgłasza wersję z FAKE_VERSION, a zamiast kopii zapisuje do
// pliku z `--file=` swoje argumenty i obecność PGPASSWORD.
const dir = mkdtempSync(join(tmpdir(), "byw-db-dump-"));
const fakePgDump = join(dir, "pg_dump");
writeFileSync(
  fakePgDump,
  `#!/bin/sh
if [ "$1" = "--version" ]; then echo "pg_dump (PostgreSQL) $FAKE_VERSION (Ubuntu $FAKE_VERSION-0ubuntu0.24.04.1)"; exit 0; fi
for arg in "$@"; do case "$arg" in --file=*) file="\${arg#--file=}";; esac; done
printf '%s\\n' "$*" "PGPASSWORD=\${PGPASSWORD:+set}" > "$file"
`,
  { mode: 0o755 },
);

function dump(version: string, file: string) {
  const result = spawnSync(
    "node_modules/.bin/tsx",
    ["scripts/db-dump.ts", file],
    {
      encoding: "utf8",
      env: { ...process.env, PG_DUMP: fakePgDump, FAKE_VERSION: version },
    },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("npm run db:dump", () => {
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("odmawia, gdy pg_dump jest starszy niż serwer", () => {
    const file = join(dir, "stara.dump");
    const result = dump("9.6.24", file);
    expect(result.status).toBe(1);
    expect(result.output).toMatch(
      /pg_dump w wersji 9 jest starszy niż serwer \(\d+\)/,
    );
    expect(existsSync(file)).toBe(false);
  });

  it("przekazuje hasło przez PGPASSWORD, nie w argumentach, i zapisuje plik z prawami 600", () => {
    const file = join(dir, "kopia.dump");
    const result = dump("99.0", file);
    expect(result).toEqual({
      status: 0,
      output: `Zapisano kopię bazy: ${file}\n`,
    });
    const [args, password] = readFileSync(file, "utf8").trim().split("\n");
    const url = new URL(process.env.DATABASE_URL!);
    expect(args).toContain("--format=custom");
    expect(args).not.toContain(`:${url.password}@`);
    expect(password).toBe("PGPASSWORD=set");
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });
});
