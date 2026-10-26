# Zamknięcie MVP (T15)

Dokument zamknięcia wydania wg [`docs/WORKFLOW.md`](WORKFLOW.md) etap G.
Dotyczy zadania T15 ([#16](https://github.com/jtrawnicki/BuildYourWealth/issues/16))
i milestone'u M6. Zebrane tu dowody odnoszą się do stanu gałęzi `main`
po zmerge'owaniu T1–T16 (PR #17–#46).

Dokument nie powtarza reguł ze `SPEC.md`, `STACK.md` ani `PLAN.md` — zbiera
wyłącznie stan weryfikacji i listę kroków, które zgodnie z planem wykonuje
człowiek (właściciel produktu) na własnych środowiskach.

## 1. Bramka jakości

| Kontrola | Zakres | Stan |
| --- | --- | --- |
| `npm run lint` | ESLint + `prettier --check` | zielona w CI (Linux, LF) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` | zielona |
| `npm test` | Vitest (`src/**`, `scripts/**`) na `byw_test` | zielona w CI (Postgres 17) |
| `npm run build` | build produkcyjny Next.js | zielona w CI |
| `npm run e2e` | Playwright, projekty `chromium` i `demo` | zielona w CI |

Źródłem prawdy dla pełnej bramki jest CI (`.github/workflows/ci.yml`),
uruchamiane przy każdym PR na Postgres 17; ostatni przebieg na `main` jest
zielony. Lokalnie na Windowsie `prettier --check` zgłasza wszystkie pliki
z powodu `core.autocrlf=true` (repo trzyma LF) — to artefakt środowiska,
nie błąd formatowania; na Linuksie w CI kontrola przechodzi.

## 2. Pokrycie scenariuszy akceptacyjnych (SPEC 12)

Wszystkie 21 scenariuszy ma zielony test automatyczny. Numery wierszy
wskazują reprezentatywny test; część scenariuszy ma ich więcej.

| # | Scenariusz | Pokrycie |
| --- | --- | --- |
| 1 | Plan miesiąca | `src/domain/plan.test.ts:10`; e2e `e2e/ten-miesiac.spec.ts:269` |
| 2 | Zaokrąglenie | `src/domain/plan.test.ts:33` |
| 3 | Walidacja sumy celów | `src/domain/plan.test.ts:139`; `src/app/(app)/plan/actions.test.ts:75`; e2e `e2e/plan.spec.ts:56` |
| 4 | Rozliczenie zgodne z planem | `src/db/settlement.test.ts:121` |
| 5 | Rozliczenie częściowe | `src/db/settlement.test.ts:141`; e2e `e2e/historia.spec.ts:79` |
| 6 | Źródło/cel w EUR | `src/domain/currency.test.ts:10`; `src/db/settlement.test.ts:186`; e2e `e2e/majatek.spec.ts:106` |
| 7 | Zaległy miesiąc | e2e `e2e/ten-miesiac.spec.ts:514` |
| 8 | Zmiana planu nie zmienia historii | `src/db/months.test.ts:181`, `:479`; e2e `e2e/historia.spec.ts:102` |
| 9 | Wypłata (zmniejszenie wartości) | e2e `e2e/majatek.spec.ts:142` |
| 10 | Cel osiągnięty | `src/domain/progress.test.ts:23`; e2e `e2e/ten-miesiac.spec.ts:323` |
| 11 | Postęp celu | `src/domain/progress.test.ts:5`; `src/domain/format.test.ts:53`; `src/db/settlement.test.ts:213` |
| 12 | Motywy i 360 px (każdy ekran) | patrz niżej |
| 13 | Dostęp bez sesji / piaskownicy | `src/auth/guard.ts` + testy akcji „bez sesji" w każdej grupie; e2e `e2e/logowanie.spec.ts:24`, `e2e/demo/start.spec.ts:11` |
| 14 | Reszta z zaokrągleń | `src/domain/plan.test.ts:49`; e2e `e2e/ten-miesiac.spec.ts:303` |
| 15 | Podwójne rozliczenie | `src/db/settlement.test.ts:264`; `src/app/(app)/rozliczenie/[miesiac]/actions.test.ts:140` |
| 16 | Archiwizacja | `src/db/sources.test.ts:143`; e2e `e2e/majatek.spec.ts:190` |
| 17 | Cel w EUR (postęp) | `src/domain/progress.test.ts:9`; `src/domain/format.test.ts:59` |
| 18 | Poprzedni miesiąc | `src/db/months.test.ts:158`; `src/domain/time.test.ts:77` |
| 19 | Wejście do demo | e2e `e2e/demo/sandbox.spec.ts:28`, `:50` |
| 20 | Wygaśnięcie demo | e2e `e2e/demo/sandbox.spec.ts:80` |
| 21 | Separacja wersji | `src/app/logowanie/actions.test.ts:21`; e2e `e2e/demo/start.spec.ts:11`, `e2e/demo/sandbox.spec.ts:50`; dostępność z sieci: krok ręczny (§5) |

### Scenariusz 12 na każdym ekranie

Scenariusz 12 (oba motywy i 360 px bez przewijania w poziomie) jest pokryty
testami Playwright uruchamianymi w obu motywach (`colorScheme` jasny i ciemny)
przy szerokości 360 px:

- układ i nawigacja — `e2e/layout.spec.ts:19`;
- Ten miesiąc, Historia, Rozliczenie, zaległe — `e2e/ten-miesiac.spec.ts:558`;
- Majątek, Plan podziału — `e2e/majatek.spec.ts:273`;
- przełączanie i brak mignięcia motywu — `e2e/theme.spec.ts`;
- Ustawienia (motyw) — `e2e/ustawienia.spec.ts:135`.

Wizualne porównanie z makietami wariantu B (B1/B2/B3) pozostaje w gestii
właściciela produktu (§5, krok ręczny) — testy sprawdzają zachowanie
i brak przewijania w poziomie, nie zgodność pikselową z makietą.

## 3. Audyt bezpieczeństwa

Niezależne review bezpieczeństwa odbyło się na poziomie zadań (T3 logowanie,
T4a tryby, T16 piaskownice) oraz w przekrojowych PR-ach OWASP 2025
(#43–#46: nagłówki bezpieczeństwa, code scanning, Semgrep w CI). Poniżej
potwierdzenie niezmienników wydania na stanie `main`.

| Niezmiennik wydania | Mechanizm | Dowód |
| --- | --- | --- |
| Wersja prywatna niedostępna z sieci | serwer `next start -H 127.0.0.1`, port bazy tylko na `127.0.0.1` | `scripts/private-env.ts:8`, `scripts/private.ts:113`, `compose.yaml:10` |
| Demo bez logowania hasłem | `login()` odrzuca w trybie demo przed dotknięciem bazy; brak formularza na ekranie startowym | `src/app/logowanie/actions.ts:31` |
| Vercel wymusza tryb demo (fail closed) | `resolveAppMode` zgłasza błąd przy `VERCEL_ENV` bez `APP_MODE=demo` (build i runtime) | `src/demo/mode.ts:19` |
| Brak jawnego IP w bazie | przechowywany wyłącznie HMAC-SHA-256; brak `DEMO_IP_SECRET` to błąd (fail closed) | `src/demo/ip.ts:15`, `:20` |
| Izolacja piaskownic | każda piaskownica to osobne konto i sesja; dane przez FK właściciela | `src/db/demo.ts:91`, `src/auth/guard.ts` |
| Odporność demo na nadużycia | limity 10/IP/h i 500 aktywnych liczone w jednej transakcji; leniwe sprzątanie wygasłych (kaskada) | `src/db/demo.ts:57`, `:71`, `:87` |
| Dostęp wyłącznie z sesją | `requireUser()` w każdej stronie i akcji przekierowuje bez sesji | `src/auth/guard.ts`, scen. 13 |
| Ciasteczko sesji | `HttpOnly`, `Secure`, `SameSite=Lax` | T3, scen. 13 |

Nie znaleziono blokujących problemów. Werdykt audytu: **APPROVE**.

> Uwaga procesowa: zgodnie z WORKFLOW rozdz. 2 implementer nie powinien być
> jedynym recenzentem własnej zmiany. Zmiana T15 to wyłącznie dokumentacja
> i backlog (bez kodu produktu), a niezmienniki wyżej były recenzowane
> niezależnie przy swoich zadaniach. Dla ryzykownego wydania właściciel może
> zlecić dodatkowy, niezależny audyt eksploracyjny przed upublicznieniem demo.

## 4. Backlog poza MVP (SPEC 9)

11 pozycji ze SPEC 9 zapisano jako Issues z etykietą `post-mvp`:
[#55](https://github.com/jtrawnicki/BuildYourWealth/issues/55)–[#65](https://github.com/jtrawnicki/BuildYourWealth/issues/65).
Są świadomie odłożone poza MVP; realizacja po wydaniu, według priorytetów
właściciela produktu.

## 5. Kroki ręczne właściciela produktu

Te kryteria T15 z definicji wymagają rąk i środowisk właściciela; agent ich
nie wykonuje. Odhacz po wykonaniu:

### 5.1 Ręczny scenariusz akceptacyjny (wersja prywatna)

- [ ] `npm run private:start` startuje; `http://127.0.0.1:4000` pokazuje logowanie.
- [ ] Adres komputera w sieci lokalnej (np. z telefonu) nie odpowiada (scen. 21).
- [ ] Logowanie poprawnym hasłem wpuszcza; wylogowanie wraca na logowanie.
- [ ] Przejście przez przepływy: Majątek, Plan podziału, Ten miesiąc,
      Rozliczenie, Historia, Ustawienia — zgodnie ze SPEC 5.
- [ ] Scen. 12 na każdym ekranie: oba motywy i 360 px, porównanie z makietami B.

### 5.2 Przegląd demo na Vercel (po wdrożeniu T16)

- [ ] Uzupełniony adres demo w [`AGENTS.md`](../AGENTS.md) („Adres demo").
- [ ] Zmienne w Vercel (zakres Production): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
      `APP_MODE=demo`, `DEMO_IP_SECRET`.
- [ ] Smoke test demo z listy w `AGENTS.md` („Smoke test demo po wdrożeniu"):
      HTTPS, ekran startowy bez logowania, „Wypróbuj wersję demo", osobne dane
      w drugiej przeglądarce, „Wyloguj", brak deploymentu z gałęzi innej niż `main`.

### 5.3 Próbna kopia i odtworzenie

- [ ] `npm run private:dump` tworzy plik kopii `byw_private` w `backups/`.
- [ ] `pg_restore` odtwarza kopię do pustej bazy bez błędów
      (np. `docker compose exec -T db pg_restore -U byw -d <pusta_baza> < plik`).

### 5.4 Zamknięcie

- [ ] Po merge'u tego PR: Issue [#16](https://github.com/jtrawnicki/BuildYourWealth/issues/16)
      zamknięte (przez „Closes #16" w PR albo ręcznie), milestone M6 zamknięty.

## 6. Retrospektywa (WORKFLOW rozdz. 12)

- **Co przyspieszyło pracę:** jeden kontrakt danych (`src/db`) i czyste funkcje
  domeny (`src/domain`) z testami odtwarzającymi liczby ze SPEC 12 pozwoliły
  budować UI na gotowych, zweryfikowanych regułach; kolejność T5–T6 przed UI
  się opłaciła.
- **Co wymagało interwencji człowieka:** założenie kont Vercel/Neon i zmienne
  środowiskowe (T4, T4a, T16), ustawianie haseł poza agentem, rozstrzygnięcie
  produktowe P7 (usunięcie ostatniego przychodu) oraz zmiana koncepcji wdrożenia
  P8 (prywatne lokalnie + publiczne demo).
- **Co ominęło testy/review wcześniej:** nagłówki bezpieczeństwa i ostrzeżenia
  code scanning dołożono dopiero przekrojowo (#43–#46) po implementacji funkcji.
- **Które instrukcje były użyteczne:** konwencja „każda strona i akcja ma test
  bez sesji" (AGENTS.md) dała równe pokrycie scen. 13; podział źródeł prawdy
  SPEC/STACK/PLAN ograniczył duplikację reguł.
- **Co można uprościć:** brak `.gitattributes` powoduje szum `prettier` na
  Windowsie — dodanie `* text=auto eol=lf` usunęłoby lokalny fałszywy alarm
  (drobny dług, poza zakresem T15).
- **Co zdecydować wcześniej następnym razem:** model wdrożenia (prywatne vs
  publiczne demo) — zmiana P8 w trakcie wymusiła T4a i T16 oraz przepisanie T4.
