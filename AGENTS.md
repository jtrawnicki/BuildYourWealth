# AGENTS.md

Instrukcje dla agentów pracujących w tym repozytorium. Reguły produktu
i decyzje techniczne żyją w dokumentach źródłowych; tutaj są tylko odwołania
i praktyczne kroki.

## Źródła prawdy

| Dokument | Po co |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Co budujemy: zachowanie, komunikaty, scenariusze akceptacyjne (rozdz. 12). |
| [`STACK.md`](STACK.md) | Stos, architektura (`src/domain`, `src/db`, `src/auth`, `src/demo`, `src/app`, `src/ui`), model danych, środowiska, bramka jakości. |
| [`PLAN.md`](PLAN.md) | Kolejność zadań T1–T16 (z T4a), zależności, kryteria akceptacji. Każde zadanie ma Issue na GitHub. |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Proces: poziomy weryfikacji, niezależne review, warunki merge'u. |
| [`docs/design/`](docs/design/README.md) | Makiety wariantu B (wzór wyglądu, nie kod). |

Nie kopiuj reguł z tych dokumentów do kodu ani komentarzy. W razie konfliktu
między dokumentami zgłoś go zamiast wybierać wygodniejszą wersję.

## Dwie wersje aplikacji

Ten sam kod działa jako **wersja prywatna** (prawdziwe dane właściciela,
tylko lokalnie, baza `byw_private`) i jako **demo** (Vercel + Neon, dane
wygenerowane, piaskownica dla każdego odwiedzającego). Decyzja: SPEC P8,
szczegóły: STACK 5 „Tryby aplikacji” i STACK 6.

Agent **nigdy** nie czyta `.env.private`, nie łączy się z bazą `byw_private`
i nie uruchamia skryptów `private:*`. Do pracy służą `byw_dev` i `byw_test`.

## Uruchomienie

Wymagany Node 22 (`.nvmrc`) i Postgres 17 (w sesji chmurowej wystarczy 16,
STACK 6). Każdy sposób uruchomienia bazy daje te same adresy:
`byw_dev` dla aplikacji (`.env`) i `byw_test` dla testów (`.env.test`).

**Komputer z Dockerem:**

```bash
docker compose up -d db      # Postgres 17, tworzy byw_dev i byw_test
cp .env.example .env
npm ci
npm run db:migrate           # schemat w byw_dev
npm run dev                  # http://localhost:3000
```

Skrypt tworzący `byw_test` działa tylko przy pierwszym starcie z pustym
wolumenem; jeśli wolumen istniał wcześniej, utwórz bazę od nowa przez
`docker compose down -v && docker compose up -d db`.

**Sesja chmurowa agenta (bez Dockera):** hook `.claude/hooks/session-start.sh`
instaluje zależności, uruchamia lokalny klaster Postgres, tworzy rolę `byw`,
bazy `byw_dev` i `byw_test`, plik `.env` i migruje `byw_dev`. Po starcie sesji wystarczy
`npm run dev`. Hook można uruchomić ponownie ręcznie:
`CLAUDE_CODE_REMOTE=true CLAUDE_PROJECT_DIR=$PWD .claude/hooks/session-start.sh`.

**Dowolny inny Postgres:** ustaw `DATABASE_URL` (w formie URL). Zmienna
z powłoki ma pierwszeństwo przed `.env` i `.env.test`, także w testach.
Testy odmawiają pracy na bazie, której nazwa nie kończy się na `_test`.
Rola testowa potrzebuje prawa `CREATEDB`, bo test migracji tworzy na chwilę
pustą bazę.

## Baza i skrypty administracyjne

| Polecenie | Działanie |
| --- | --- |
| `npm run db:generate` | Nowa migracja SQL w `drizzle/` po zmianie `src/db/schema.ts` (commitowana razem ze schematem). |
| `npm run db:migrate` | Stosuje migracje na bazie z `DATABASE_URL`. `npm test` migruje bazę testową sam. |
| `npm run user:set-password -- <email>` | Tworzy konto albo ustawia nowe hasło (min. 12 znaków) i unieważnia sesje. Hasło z terminala bez echa albo z wejścia standardowego. |
| `npm run db:dump [-- <plik>]` | `pg_dump` w formacie custom do `backups/` (poza repozytorium); odtwarzanie przez `pg_restore`. Odmawia, gdy `pg_dump` jest starszy niż serwer; `PG_DUMP` wskazuje inny program `pg_dump`. |

Skrypty i `drizzle-kit` biorą `DATABASE_URL` z powłoki, a gdy jej brak,
wyłącznie z `.env` (nie z `.env.local` ani `.env.production*`).

## Bramka jakości

| Polecenie | Zakres |
| --- | --- |
| `npm run lint` | ESLint + `prettier --check` (`npm run format` poprawia formatowanie) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest (`src/**/*.test.ts`, `scripts/**/*.test.ts`) na bazie z `.env.test` |
| `npm run build` | build produkcyjny Next.js |
| `npm run e2e` | Playwright (`e2e/`) na zbudowanej aplikacji w obu trybach (projekty `chromium` i `demo`, porty 3100 i 3101); najpierw `npm run build` |

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

## Wersja prywatna (komputer właściciela)

Wymaga Node 22 i Docker Desktop (baza działa w kontenerze z `compose.yaml`,
port tylko na `127.0.0.1`). Skrypty same uruchamiają kontener, tworzą bazę
`byw_private`, jeśli jej brakuje, i stosują migracje (STACK 5 „Wersja
prywatna”).

Pierwsze uruchomienie (raz), w klonie repozytorium po `npm ci`:

1. `cp .env.private.example .env.private`.
2. `npm run private:set-password -- <twój-email>` (hasło min. 12 znaków,
   bez echa; nie przechodzi przez agenta).

| Polecenie | Działanie |
| --- | --- |
| `npm run private:start` | Buduje aplikację (do `.next-private`) i uruchamia ją na `http://127.0.0.1:4000`. Po `git pull` stosuje nowe migracje. Zatrzymanie: Ctrl+C. |
| `npm run private:set-password -- <email>` | Konto albo nowe hasło w wersji prywatnej. |
| `npm run private:dump [-- <plik>]` | Kopia `byw_private` do `backups/` przez `pg_dump` z kontenera bazy. |

Kopia zapasowa: np. po każdym rozliczeniu i zawsze przed aktualizacją
z nową migracją. Plik zawiera prawdziwe dane: przenieś go na osobny nośnik,
nie wysyłaj do repozytorium ani niezaszyfrowanej chmury. Odtwarzanie:
`pg_restore` (np. `docker compose exec -T db pg_restore -U byw -d <pusta_baza> < plik`).

## Wersja demo (Vercel + Neon)

Demo działa na Vercel (plan Hobby, region `fra1`), dane w Neon (plan Free,
Frankfurt, Postgres 17), wyłącznie wygenerowane. Decyzje i kontekst: STACK 6
i 9. Wdrożenie jest sterowane z repozytorium (`vercel.json`, polecenie
budowania), a pierwsze połączenie kont wymaga rąk właściciela — kroki niżej.
Do czasu T16 ekran startowy demo informuje tylko, że demo jest
w przygotowaniu.

**Adres demo:** `https://<do-uzupełnienia>.vercel.app`
**Projekt Neon:** `sparkling-pine-36966267` (Frankfurt, Postgres 17).

### Konfiguracja w repozytorium

- `vercel.json` ustawia framework Next.js, polecenie budowania
  `npm run vercel-build` oraz `git.deploymentEnabled` tak, że deploy powstaje
  **tylko z gałęzi `main`** (`"**": false`, `"main": true`). Wzorce to
  minimatch: `*` nie obejmuje nazw gałęzi z `/` (np. `docs/...`), stąd `**`.
  Pushe na inne gałęzie (w tym PR) nie tworzą deploymentu, więc podglądy są
  wyłączone.
- `npm run vercel-build` (`scripts/vercel-build.ts`): na produkcji
  (`VERCEL_ENV=production`) uruchamia najpierw `npm run db:migrate`, potem
  `next build`; na innych środowiskach tylko `next build`.
- Migracje w produkcji łączą się **adresem bezpośrednim**
  (`DATABASE_URL_UNPOOLED`), a aplikacja w runtime **adresem z poolerem**
  (`DATABASE_URL`) — patrz `drizzle.config.ts` i `src/db/client.ts`.

### Zmienne środowiskowe w Vercel (zakres „Production”)

Ustawione tylko w zakresie **Production**, żeby żadne inne środowisko nie
łączyło się z bazą demo. Adresy bazy skopiuj z panelu Neon (Connection
Details) dokładnie tak, jak je podaje:

| Zmienna | Adres Neon | Użycie |
| --- | --- | --- |
| `DATABASE_URL` | z poolerem (`...-pooler...`) | runtime aplikacji |
| `DATABASE_URL_UNPOOLED` | bezpośredni (bez `-pooler`) | migracje w buildzie |
| `APP_MODE` | — (wartość `demo`) | tryb aplikacji; inny blokuje build |
| `DEMO_IP_SECRET` | — (losowy sekret, od T16) | skrót adresu IP do limitów demo |

### Pierwsze wdrożenie (kroki właściciela)

1. W Vercel: **Add New → Project → Import** repozytorium `BuildYourWealth`.
   Framework wykryje się jako Next.js; nie zmieniaj polecenia budowania
   (bierze się z `vercel.json`). Production Branch pozostaw `main`.
2. W **Settings → Environment Variables** dodaj zmienne z tabeli wyżej
   w zakresie **Production** (każdą od zadania podanego w tabeli).
3. Deploy ruszy po merge’u do `main` (albo „Redeploy” z panelu). Build
   zastosuje migracje i zbuduje aplikację.

Demo nie ma konta właściciela ani kopii zapasowej: dane są wygenerowane
i odtwarzalne. Konto utworzone w Neon w ramach T4 usuwa właściciel w T4a.

### Wycofanie

W Vercel: **Deployments → wybierz poprzedni udany → Promote to Production**.
Migracje są dodające i zgodne wstecz (STACK 6), więc poprzedni build działa na
bieżącym schemacie.

### Smoke test demo po wdrożeniu (od T16)

- [ ] `https://<adres>.vercel.app` otwiera się po HTTPS.
- [ ] Strona bez piaskownicy pokazuje ekran startowy demo, bez formularza logowania.
- [ ] „Wypróbuj wersję demo” otwiera „Ten miesiąc” z danymi i banerem demo.
- [ ] Druga przeglądarka dostaje inne dane; „Wyloguj” wraca na ekran startowy.
- [ ] Push na gałąź inną niż `main` nie tworzy deploymentu.

### Smoke test wersji prywatnej

- [ ] `npm run private:start` startuje, `http://127.0.0.1:4000` pokazuje logowanie.
- [ ] Adres komputera w sieci lokalnej (np. z telefonu) nie odpowiada.
- [ ] Logowanie poprawnym hasłem wpuszcza do aplikacji; wylogowanie wraca na logowanie.
- [ ] `npm run private:dump` tworzy plik kopii w `backups/`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
