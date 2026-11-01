# Zamknięcie Etapu 2 (T26)

Dokument zamknięcia wydania wg [`docs/WORKFLOW.md`](WORKFLOW.md) etap G.
Dotyczy zadania T26 ([#82](https://github.com/jtrawnicki/BuildYourWealth/issues/82))
i milestone'u M11. Zebrane tu dowody odnoszą się do stanu gałęzi `main`
po zmerge'owaniu zadań Etapu 2 (PR #67–#104).

Dokument nie powtarza reguł ze `SPEC.md`, `STACK.md` ani `PLAN.md` — zbiera
wyłącznie stan weryfikacji i listę kroków, które zgodnie z planem wykonuje
człowiek (właściciel produktu) na własnych środowiskach. Zamknięcie MVP opisuje
[`RELEASE-MVP.md`](RELEASE-MVP.md); tu rozliczamy to, co dołożył Etap 2.

## 1. Zakres Etapu 2

Etap 2 objął milestone'y M7–M11. W trakcie prac zmieniła się koncepcja:
powiadomienia e-mail (pierwotne T23–T25) zostały wycofane (decyzja P24,
scenariusze 29–33 wycofane) i zastąpione **prognozą majątku** (PR #92; T27–T29).

| Obszar | Zadania | PR |
| --- | --- | --- |
| Reskin „Portfel” (wygląd wariantu B) | — | #68, #83, #84 |
| Specyfikacja i plan Etapu 2 | — | #67, #69 |
| Historia wartości źródeł | T17 | #85 |
| Kursy NBP: pobieranie i wybór | T18 | #86 |
| Kurs NBP w rozliczeniu i na ekranach | T19a, T19b | #87, #89 |
| Wykres wartości majątku | T20 | #91 |
| Termin celu i prognoza celu | T21, T22 | #88, #96, #97 |
| Prognoza majątku (domena, stopa, zakładka) | T27, T28, T29 | #99, #100, #101 |
| Źródło niewliczane do majątku | — | #98 |
| Poprawki responsywności (telefon) | — | #102, #103, #104 |

## 2. Bramka jakości

| Kontrola | Zakres | Stan |
| --- | --- | --- |
| `npm run lint` | ESLint + `prettier --check` | zielona w CI (Linux, LF) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` | zielona |
| `npm test` | Vitest (`src/**`, `scripts/**`) na `byw_test` | zielona w CI (Postgres 17) |
| `npm run build` | build produkcyjny Next.js | zielona w CI |
| `npm run e2e` | Playwright, projekty `chromium` i `demo` | zielona w CI |

Źródłem prawdy dla pełnej bramki jest CI (`.github/workflows/ci.yml`),
uruchamiane przy każdym PR na Postgres 17; ostatni przebieg na `main`
(merge PR #104) jest zielony. Lokalnie na Windowsie `prettier --check` zgłasza
pliki z powodu `core.autocrlf` (repo trzyma LF), a testy spawnujące skrypty
bywają mylące — to artefakty środowiska, nie błędy; prawdę mówi CI na Linuksie.

## 3. Pokrycie scenariuszy akceptacyjnych (SPEC 12)

Scenariusze 1–21 (MVP) nadal mają zielone testy — mapowanie w
[`RELEASE-MVP.md`](RELEASE-MVP.md) §2. Scenariusze 29–33 zostały wycofane razem
z powiadomieniami e-mail (P24). Poniżej scenariusze dołożone lub zmienione
w Etapie 2 (22–28, 34–49); numery wierszy wskazują reprezentatywny test.

| # | Scenariusz | Pokrycie |
| --- | --- | --- |
| 22 | Bieżący kurs NBP | `src/rates/label.test.ts:13`; `src/rates/current-rate.ts` |
| 23 | Kurs rozliczenia | `src/rates/settlement-rate.test.ts:59`; `src/rates/select.test.ts:25`; e2e `e2e/rozliczenie.spec.ts:212` |
| 24 | Kurs zapasowy | `src/rates/settlement-rate.test.ts:85`; `src/rates/select.test.ts:59`; e2e `e2e/rozliczenie.spec.ts:175`, `:194` |
| 25 | Stan na koniec miesiąca | `src/domain/networth-chart.test.ts:24`; e2e `e2e/majatek.spec.ts:397` |
| 26 | Pusty wykres | e2e `e2e/majatek.spec.ts:385`, `:397` |
| 27 | Prognoza celu z terminem | `src/domain/forecast.test.ts`; e2e `e2e/termin-celu.spec.ts:106` |
| 28 | Prognoza celu bez terminu | `src/domain/forecast.test.ts`; e2e `e2e/termin-celu.spec.ts:146`, `:157` |
| 34 | Demo w Etapie 2 | e2e `e2e/demo/sandbox.spec.ts:80` |
| 35 | Rozliczenie przed publikacją tabeli | `src/rates/settlement-rate.test.ts:71`; `src/rates/select.test.ts:34`; e2e `e2e/rozliczenie.spec.ts:234` |
| 36 | Zmiana kursu w trakcie rozliczenia | e2e `e2e/rozliczenie.spec.ts:251` |
| 37 | Nowy procent a prognoza | e2e `e2e/termin-celu.spec.ts:168` |
| 38 | Brak danych (cel spoza migawek) | `src/domain/forecast.test.ts:255`; e2e `e2e/termin-celu.spec.ts:189` |
| 39 | Rozliczenia sprzed Etapu 2 | `src/rates/label.test.ts:39` |
| 40 | Prognoza majątku | `src/domain/wealth-forecast.test.ts:50`; e2e `e2e/prognoza.spec.ts:62` |
| 41 | Punkt wyjścia i zdanie kontrolne | `src/domain/wealth-forecast.test.ts:56`, `:92`; e2e `e2e/prognoza.spec.ts:117`, `:133` |
| 42 | Średni przychód z mniejszej liczby miesięcy | `src/domain/wealth-forecast.test.ts:178`; e2e `e2e/prognoza.spec.ts:144`, `:168` |
| 43 | Stopa zwrotu na Majątku | e2e `e2e/majatek.spec.ts:157`; `e2e/prognoza.spec.ts:331` |
| 44 | Horyzont | `src/domain/wealth-forecast.test.ts:267`; e2e `e2e/prognoza.spec.ts:200` |
| 45 | Źródło EUR w prognozie | `src/domain/wealth-forecast.test.ts:375`; e2e `e2e/prognoza.spec.ts:230` |
| 46 | Nawigacja na telefonie (sześć zakładek) | e2e `e2e/layout.spec.ts:12`, `:32` |
| 47 | Prognoza bez połączeń zewnętrznych | e2e `e2e/prognoza.spec.ts:266` |
| 48 | Zysk ujemny i zerowy | `src/domain/wealth-forecast.test.ts:329`, `:365`; e2e `e2e/prognoza.spec.ts:294`, `:309` |
| 49 | Źródło wykluczone z majątku | `src/db/sources.test.ts:482`; `src/domain/wealth-forecast.test.ts:248`; `src/app/(app)/prognoza/forecast-data.ts:60` |

### Scenariusz 12 i 13 na nowych ekranach

Scenariusz 12 (oba motywy i telefon bez przewijania w poziomie) dla ekranów
Etapu 2: wykres Majątku — `e2e/majatek.spec.ts:425`; Plan podziału z terminem —
`e2e/termin-celu.spec.ts:254`; Prognoza — `e2e/prognoza.spec.ts`; dolna belka
z sześcioma zakładkami przy 360 px — `e2e/layout.spec.ts:32` (scen. 46).

Scenariusz 13 (dostęp bez sesji / piaskownicy) pokrywa konwencja „każda strona
i akcja ma test bez sesji": Prognoza — `e2e/prognoza.spec.ts:54`; Plan z terminem
— `e2e/termin-celu.spec.ts:98`; Majątek ze stopą — `e2e/majatek.spec.ts:70`;
plus testy akcji „bez sesji" w grupach `prognoza`, `majatek`, `rozliczenie`.

## 4. Audyt bezpieczeństwa

Niezależne review bezpieczeństwa odbywało się na poziomie zadań Etapu 2.
Poniżej potwierdzenie niezmienników wydania dołożonych przez Etap 2 na stanie
`main`; niezmienniki MVP (logowanie, izolacja piaskownic, ciasteczko sesji)
pozostają w mocy — [`RELEASE-MVP.md`](RELEASE-MVP.md) §3.

| Niezmiennik wydania | Mechanizm | Dowód |
| --- | --- | --- |
| Jedyne połączenie wychodzące to NBP | wbudowany `fetch` wyłącznie do `https://api.nbp.pl`; w całym `src/` nie ma innego `fetch` | `src/rates/nbp.ts:26` |
| Prognoza nie wysyła danych poza aplikację | liczona po stronie serwera z danych konta; brak żądań sieciowych przy otwarciu i zmianie horyzontu | `src/domain/wealth-forecast.ts`, scen. 47 (`e2e/prognoza.spec.ts:266`) |
| Kursy demo nie są podpisane jako NBP | w demo źródło kursu rozliczenia to zawsze `fallback`, nigdy `nbp` (SPEC Z16) | `src/demo/generate.ts:72`, `src/rates/label.ts:59` |
| Wersja prywatna niedostępna z sieci | serwer `next start -H 127.0.0.1`, port bazy tylko na `127.0.0.1` | `scripts/private-env.ts`, `scripts/private.ts`, `compose.yaml` |
| Prognoza liczy tylko aktywne, niewykluczone źródła | źródła wykluczone z majątku i zarchiwizowane nie wchodzą do prognozy | `src/app/(app)/prognoza/forecast-data.ts:60`, scen. 49 |

Nie znaleziono blokujących problemów. Werdykt audytu: **APPROVE**.

> Uwaga procesowa: zgodnie z WORKFLOW rozdz. 2 implementer nie powinien być
> jedynym recenzentem własnej zmiany. Zmiana T26 to wyłącznie dokumentacja
> (raport wydania, bez kodu produktu), a niezmienniki wyżej były recenzowane
> niezależnie przy swoich zadaniach.

## 5. Kroki ręczne właściciela produktu

Te kryteria T26 z definicji wymagają rąk i środowisk właściciela; agent ich
nie wykonuje. Odhacz po wykonaniu:

### 5.1 Wersja prywatna: aktualizacja z kopią przed migracją

- [ ] `npm run private:dump` — kopia `byw_private` przed migracją (T17 wnosi
      pierwszą migrację zmieniającą dane; AGENTS.md „Aktualizacja do nowej wersji").
- [ ] `npm run private:start` stosuje migracje i startuje; `http://127.0.0.1:4000`
      pokazuje logowanie.
- [ ] Adres komputera w sieci lokalnej (np. z telefonu) nie odpowiada (scen. 21).
- [ ] Właściciel wpisał zakładane stopy zwrotu swoich źródeł (scen. 43) i obejrzał
      zakładkę Prognoza (scen. 40–48).
- [ ] Scen. 12 na ekranach Etapu 2: oba motywy i telefon, porównanie z makietami B.

### 5.2 Smoke test demo na Vercel (po wdrożeniu T16/T29)

- [ ] `https://<adres>.vercel.app` otwiera się po HTTPS.
- [ ] Strona bez piaskownicy pokazuje ekran startowy demo, bez formularza logowania.
- [ ] „Wypróbuj wersję demo" otwiera „Ten miesiąc" z danymi i banerem demo.
- [ ] Zakładka **Prognoza** w demo pokazuje scenariusze i źródła ze stopami (scen. 34).
- [ ] Druga przeglądarka dostaje inne dane; „Wyloguj" wraca na ekran startowy.
- [ ] Push na gałąź inną niż `main` nie tworzy deploymentu.

### 5.3 Zamknięcie

- [ ] Po merge'u tego PR: Issue [#82](https://github.com/jtrawnicki/BuildYourWealth/issues/82)
      zamknięte (przez „Closes #82" w PR albo ręcznie), milestone M11 zamknięty,
      a wraz z nim milestone'y M7–M10 (bez otwartych Issues).

## 6. Retrospektywa (WORKFLOW rozdz. 12)

- **Co przyspieszyło pracę:** czyste funkcje domeny z testami odtwarzającymi
  liczby ze SPEC (`src/domain/wealth-forecast.test.ts`, `forecast.test.ts`)
  pozwoliły zbudować Prognozę i termin celu na zweryfikowanych regułach; warstwa
  kursów (`src/rates`) oddzielona od UI dała komplet scenariuszy 22–24, 35–36
  bez sięgania do interfejsu.
- **Co wymagało interwencji człowieka:** ustawienie zmiennych demo na Vercel,
  wpisanie prawdziwych stóp zwrotu w wersji prywatnej, kopia przed migracją T17.
- **Największa zmiana koncepcji:** rezygnacja z powiadomień e-mail na rzecz
  prognozy majątku (P24) w trakcie etapu — wycofała T23–T25 i scenariusze 29–33,
  dołożyła T27–T29 i scenariusze 40–49. Decyzja zapadła przed implementacją
  wysyłki, więc nie zostawiła martwego kodu.
- **Co można uprościć:** brak `.gitattributes` nadal powoduje szum `prettier`
  i mylące testy na Windowsie — `* text=auto eol=lf` usunęłoby fałszywy alarm
  (drobny dług, poza zakresem T26).
- **Co zdecydować wcześniej następnym razem:** docelowy sposób motywowania
  użytkownika (powiadomienia vs prognoza) — rozstrzygnięcie w trakcie etapu
  wymusiło przepisanie trzech zadań.
