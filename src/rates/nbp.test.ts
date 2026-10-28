import { afterEach, describe, expect, it, vi } from "vitest";
import { NBP_DEFAULT_URL, nbpBaseUrl, nbpClient, splitRange } from "./nbp";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Adres w domenie `.invalid` nigdy się nie rozwiąże; testy używają atrapy `fetch`.
const BASE = "http://nbp.invalid";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const table = (effectiveDate: string, mid: number, no: string) => ({
  no,
  effectiveDate,
  mid,
});

describe("splitRange (limit NBP 93 dni)", () => {
  it("zakres do 93 dni to jedno zapytanie", () => {
    expect(splitRange("2026-01-01", "2026-04-03")).toEqual([
      { from: "2026-01-01", to: "2026-04-03" },
    ]);
    expect(splitRange("2026-10-30", "2026-10-30")).toHaveLength(1);
  });

  it("dłuższy zakres dzieli na kolejne, bez luk i nakładania", () => {
    expect(splitRange("2026-01-01", "2026-10-28")).toEqual([
      { from: "2026-01-01", to: "2026-04-03" },
      { from: "2026-04-04", to: "2026-07-05" },
      { from: "2026-07-06", to: "2026-10-06" },
      { from: "2026-10-07", to: "2026-10-28" },
    ]);
  });

  it("pusty zakres, gdy początek jest po końcu", () => {
    expect(splitRange("2026-10-29", "2026-10-28")).toEqual([]);
  });
});

describe("klient NBP", () => {
  it("pyta o tabelę A waluty i zakresu, kurs zamienia na dziesięciotysięczne", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        table: "A",
        code: "EUR",
        rates: [
          table("2026-10-26", 4.4026, "208/A/NBP/2026"),
          table("2026-10-27", 4.2731, "209/A/NBP/2026"),
        ],
      }),
    );
    const rates = await nbpClient(BASE, fetchImpl)(
      "EUR",
      "2026-10-26",
      "2026-10-27",
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]).toContain(
      `${BASE}/api/exchangerates/rates/A/EUR/2026-10-26/2026-10-27/?format=json`,
    );
    expect(rates).toEqual([
      { effectiveDate: "2026-10-26", rate: 44026, tableNo: "208/A/NBP/2026" },
      { effectiveDate: "2026-10-27", rate: 42731, tableNo: "209/A/NBP/2026" },
    ]);
  });

  it("404 to brak tabel, nie błąd", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("404 NotFound - Not Found - Brak danych", { status: 404 }),
    );
    await expect(
      nbpClient(BASE, fetchImpl)("EUR", "2026-10-24", "2026-10-25"),
    ).resolves.toEqual([]);
  });

  it("zakres dłuższy niż 93 dni wysyła kilka zapytań i łączy wyniki", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const [from] = String(url).split("/EUR/")[1].split("/");
      return from === "2026-04-04"
        ? new Response("Brak danych", { status: 404 })
        : json({ code: "EUR", rates: [table(from, 4.25, `1/A/${from}`)] });
    });
    const rates = await nbpClient(BASE, fetchImpl)(
      "EUR",
      "2026-01-01",
      "2026-10-28",
    );

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(rates.map((r) => r.effectiveDate)).toEqual([
      "2026-01-01",
      "2026-07-06",
      "2026-10-07",
    ]);
  });

  it("inny kod niż 200 i 404 jest błędem", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("Błędny zakres dat", { status: 400 }),
    );
    await expect(
      nbpClient(BASE, fetchImpl)("EUR", "2026-10-28", "2026-10-29"),
    ).rejects.toThrow("400");
  });

  it("nieoczekiwany format odpowiedzi jest błędem", async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        code: "EUR",
        rates: [{ no: "1/A", effectiveDate: "2026-10-27", mid: "4,27" }],
      }),
    );
    await expect(
      nbpClient(BASE, fetchImpl)("EUR", "2026-10-27", "2026-10-27"),
    ).rejects.toThrow("NBP");
  });

  it("zapytanie ma limit czasu", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json({ code: "EUR", rates: [] }),
    );
    await nbpClient(BASE, fetchImpl)("EUR", "2026-10-27", "2026-10-27");
    expect(fetchImpl.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("adres NBP (NBP_API_URL)", () => {
  it("domyślnie stały adres NBP", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NBP_API_URL", "");
    expect(nbpBaseUrl()).toBe(NBP_DEFAULT_URL);
  });

  it("poza Vercel zmienna podmienia adres", () => {
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NBP_API_URL", "http://127.0.0.1:9");
    expect(nbpBaseUrl()).toBe("http://127.0.0.1:9");
  });

  it("przy ustawionym VERCEL_ENV zmienna jest ignorowana", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NBP_API_URL", "http://127.0.0.1:9");
    expect(nbpBaseUrl()).toBe(NBP_DEFAULT_URL);
  });
});
