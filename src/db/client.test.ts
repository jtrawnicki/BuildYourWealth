import { afterAll, describe, expect, it } from "vitest";
import { closePool, getPool } from "./client";

describe("połączenie z bazą", () => {
  afterAll(closePool);

  it("wykonuje zapytanie na bazie z DATABASE_URL", async () => {
    const { rows } = await getPool().query<{ answer: number }>(
      "select 1 as answer",
    );
    expect(rows).toEqual([{ answer: 1 }]);
  });

  it("łączy się z Postgresem w wersji co najmniej 16 (STACK 6)", async () => {
    const { rows } = await getPool().query<{ server_version_num: string }>(
      "show server_version_num",
    );
    expect(Number(rows[0].server_version_num)).toBeGreaterThanOrEqual(160000);
  });
});
