# AGENTS.md

Instrukcje dla agentów pracujących w tym repozytorium. Reguły produktu
i decyzje techniczne żyją w dokumentach źródłowych; tutaj są tylko odwołania
i praktyczne kroki.

## Źródła prawdy

| Dokument | Po co |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Co budujemy: zachowanie, komunikaty, scenariusze akceptacyjne (rozdz. 12). |
| [`STACK.md`](STACK.md) | Stos, architektura (`src/domain`, `src/db`, `src/auth`, `src/app`, `src/ui`), model danych, środowiska, bramka jakości. |
| [`PLAN.md`](PLAN.md) | Kolejność zadań T1–T15, zależności, kryteria akceptacji. Każde zadanie ma Issue na GitHub. |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Proces: poziomy weryfikacji, niezależne review, warunki merge'u. |
| [`docs/design/`](docs/design/README.md) | Makiety wariantu B (wzór wyglądu, nie kod). |

Nie kopiuj reguł z tych dokumentów do kodu ani komentarzy. W razie konfliktu
między dokumentami zgłoś go zamiast wybierać wygodniejszą wersję.

## Uruchomienie

Wymagany Node 22 (`.nvmrc`) i Postgres 17 (w sesji chmurowej wystarczy 16,
STACK 6). Każdy sposób uruchomienia bazy daje te same adresy:
`byw_dev` dla aplikacji (`.env`) i `byw_test` dla testów (`.env.test`).

**Komputer z Dockerem:**

```bash
docker compose up -d db      # Postgres 17, tworzy byw_dev i byw_test
cp .env.example .env
npm ci
npm run dev                  # http://localhost:3000
```

Skrypt tworzący `byw_test` działa tylko przy pierwszym starcie z pustym
wolumenem; jeśli wolumen istniał wcześniej, utwórz bazę od nowa przez
`docker compose down -v && docker compose up -d db`.

**Sesja chmurowa agenta (bez Dockera):** hook `.claude/hooks/session-start.sh`
instaluje zależności, uruchamia lokalny klaster Postgres, tworzy rolę `byw`,
bazy `byw_dev` i `byw_test` oraz plik `.env`. Po starcie sesji wystarczy
`npm run dev`. Hook można uruchomić ponownie ręcznie:
`CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD .claude/hooks/session-start.sh`.

**Dowolny inny Postgres:** ustaw `DATABASE_URL`. Zmienna z powłoki ma
pierwszeństwo przed `.env` i `.env.test`, także w testach.

## Bramka jakości

| Polecenie | Zakres |
| --- | --- |
| `npm run lint` | ESLint + `prettier --check` (`npm run format` poprawia formatowanie) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest (`src/**/*.test.ts`, `scripts/**/*.test.ts`) na bazie z `.env.test` |
| `npm run build` | build produkcyjny Next.js |
| `npm run e2e` | Playwright (`e2e/`) na zbudowanej aplikacji; najpierw `npm run build` |

CI (`.github/workflows/ci.yml`) uruchamia całą bramkę przy każdym PR na
Postgres 17. Które polecenia uruchomić lokalnie, wynika z poziomu zadania
(WORKFLOW rozdz. 5); przed PR uruchom wszystkie.

`@playwright/test` jest przypięty do wersji, której przeglądarka Chromium jest
preinstalowana w sesji chmurowej (`/opt/pw-browsers`). Podnosząc wersję,
sprawdź, że e2e nadal działa w sesji bez pobierania przeglądarki.

## Konwencje

- TypeScript strict, import z `@/` wskazuje na `src/`.
- Testy jednostkowe obok kodu (`*.test.ts`), testy E2E w `e2e/`.
- Każda nowa strona i każda Server Action dostaje test „bez sesji brak
  danych”: strona przekierowuje na logowanie, akcja nie zwraca danych ani
  niczego nie zapisuje (SPEC 12, scen. 13).
- Nowa zależność produkcyjna wymaga uzasadnienia w PR (STACK 2).
- Sekrety tylko w `.env` (poza repozytorium) i ustawieniach Vercel;
  `.env.example` i `.env.test` zawierają wyłącznie lokalne dane deweloperskie.
- Jedno zadanie z `PLAN.md` = jeden branch i jeden PR, który zamyka swoje Issue.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
