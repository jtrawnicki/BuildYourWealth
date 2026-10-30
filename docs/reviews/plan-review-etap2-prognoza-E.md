# Review planu (etap E): prognoza majątku w PLAN.md i STACK.md @ 79c1c8a

Reviewer niezależny od autora planu. Zakres: zmiany z 2026-10-29
w `PLAN.md` (M10 = T27–T29, graf, T26, rozstrzygnięcia) i `STACK.md`
(sekcja „Prognoza majątku”, model danych, rozdz. 2, 3, 6, 7, decyzje 9.5–9.9)
— `git diff main...HEAD -- PLAN.md STACK.md`. Odniesienia: SPEC 5.13,
reguła 6.14, rozdz. 7, 7.1, 8.1, P24–P30, Z17–Z19, scen. 40–47;
`docs/WORKFLOW.md`; raport `spec-review-etap2-prognoza-B.md`; kod
(`src/domain/arithmetic.ts`, `src/domain/plan.ts`, `src/domain/forecast.ts`,
`src/rates/current-rate.ts`, `src/app/(app)/majatek/NetWorthChart.tsx`,
`src/ui/nav.ts`, `src/ui/MainNav.module.css`, `src/app/(app)/layout.tsx`,
`src/db/schema.ts`, `e2e/layout.spec.ts`), historia merge'ów na `main`.

## 1. Werdykt

**REQUEST CHANGES** + **HUMAN DECISION** (D1).

Plan jest mały i dobrze pocięty: czysta domena (T27) i migracja z polem
formularza (T28) idą równolegle, strona (T29) na końcu; bez nowej
zależności produkcyjnej i bez nowej infrastruktury. Wycofanie powiadomień
jest kompletne w obu dokumentach (brak `notify/`, `nodemailer`, `SMTP_*`,
`private:notify`, `risk_notified_at` poza zapisem historii decyzji). Blokują
dwie rzeczy: kryterium T27 „40 lat bez przekroczenia bezpiecznego zakresu”
jest niewykonalne przy dopuszczalnej stopie 50%, a STACK w tej sytuacji
każe stronie się wywrócić — także przy horyzoncie 5 lat (B1); część
scenariuszy 42 i 45 oraz stany braku danych nie mają testu interfejsu (B2).

## 2. Decyzje wymagane od człowieka

**D1. Zakres stopy zwrotu** — ta sama decyzja co D1 w review B
(`spec-review-etap2-prognoza-B.md`). Rekomendacja: **od −50 do 20%**; wtedy
B1 sprowadza się do testu granicznego w T27, a kwoty prognozy mieszczą się
w `number` dla wszystkich realnych danych. Przy wariancie „zostaje 50%”
STACK musi przekazywać kwoty prognozy jako `BigInt` (albo tekst) aż do
formatowania i geometrii wykresu.

## 3. Problemy blokujące

**B1. Przekroczenie zakresu przy 40 latach wywraca stronę przy każdym
horyzoncie.**
Miejsce: STACK „Prognoza majątku” (Domena, Strona `/prognoza`), PLAN T27
(kryteria), SPEC 7.1 (stopa do 50%).
- STACK: wartość poza bezpiecznym zakresem „kończy się błędem domeny”,
  a serwer liczy serie **zawsze dla 40 lat** i przekazuje je klientowi.
  Źródło 278 472,07 zł ze stopą 50% (albo wpłata 11 603,01 zł miesięcznie)
  przekracza `Number.MAX_SAFE_INTEGER` w 40. roku, więc `toSafeInteger`
  rzuci `RangeError` i cała zakładka pokaże błąd, nawet gdy użytkownik
  patrzy na 5 lat.
- PLAN T27 wymaga przypadku „horyzont 40 lat bez przekroczenia
  bezpiecznego zakresu”, czego przy obecnej walidacji nie da się spełnić
  — kryterium jest sprzeczne ze STACK.
Poprawka (po D1): przy zakresie do 20% — kryterium T27 „źródło 2 mld zł
i stopa 20% przez 40 lat mieści się w zakresie” i zdanie w STACK, że błąd
domeny jest tylko dla danych spoza walidacji. Przy 50% — STACK opisuje
`BigInt` do formatowania (React Server Components serializują `bigint`)
i geometrię wykresu w przybliżeniu, a T27 testuje 50% przez 40 lat od
2 mld zł. W obu wariantach serwer nie powinien liczyć 40 lat, jeśli wynik
może zablokować krótszy horyzont — albo STACK gwarantuje, że nie może.

**B2. Część scen. 42 i 45 oraz stany braku danych nie mają testu
interfejsu.**
Miejsce: PLAN T27, T29; STACK rozdz. 7.
T27 pokrywa 42 i 45 tylko „w części obliczeniowej”, a lista E2E w T29
i w STACK 7 to 40, 41, 43, 44, 46, 47. Nikt nie sprawdza tekstu „Prognoza
pojawi się po wpisaniu pierwszego przychodu.” z linkiem (42), dopisku
„Źródło w EUR przeliczone po bieżącym kursie 4,2700 zł (NBP, 28.10.2026),
stałym przez cały horyzont.” i prośby o kurs zapasowy zamiast prognozy
(45), ani stanów z 5.13 bez scenariusza: brak aktywnych źródeł, plan
z pulami 0% (karty „+0 zł”), brak stóp („Żadne źródło nie ma…” jest w 43,
ale tylko w E2E T29 jako „część Prognozy”).
Poprawka: dopisać 42 i 45 do E2E w T29 i w STACK 7; w kryteriach T29
wymienić stany „brak źródeł” i „pule 0%” (wystarczy test komponentu albo
jeden E2E na stan).

## 4. Weryfikacja wykonana przez reviewera

- **Mapa scenariuszy → zadania:** 40 — T27 (liczby), T29 (E2E); 41 — T27,
  T29; 42 — T27, **UI bez właściciela** (B2); 43 — T28 (zapis, walidacja,
  brak wpisu w `source_values`), T29 (część Prognozy); 44 — T29 (walidacja
  horyzontu w T27); 45 — T27, **UI bez właściciela** (B2); 46 — T29;
  47 — T29 (Playwright bez żądań na zewnątrz, test „bez sesji”); 34 (część
  Prognozy) — T28 (generator), T29 (E2E demo). T26 obejmuje 1–28 i 34–47 ✓.
- **Zależności i równoległość:** T27 nie potrzebuje niczego nowego — reguły
  2–3 są w `src/domain/plan.ts`, kursy rozliczeń w `months.settled_rate_*`
  (T19a zmergowane, PR #87), bieżący kurs w `src/rates/current-rate.ts`.
  T28 dotyka formularza źródła i generatora demo, T22 też generatora, T29
  nawigacji i nowej strony — konflikty tylko w generatorze, plan to
  zaznacza ✓. T17–T21 i T19b, T20 są już na `main` (PR #85–#91), więc
  graf „Po R” dla T29 jest w praktyce „od razu po T27 + T28” ✓.
- **Bez arytmetyki zmiennoprzecinkowej:** reguła 6.14 da się policzyć
  w całości na liczbach całkowitych (`BigInt`); przeliczyłem nią przykład
  i scen. 40–42, 44, 45 co do grosza (szczegóły w raporcie B). Wymaga
  jednak nowego zaokrąglenia ze znakiem (N4).
- **Zakres liczb:** progi przekroczenia `MAX_SAFE_INTEGER` po 480
  miesiącach — 50%: 278 472,07 zł albo 11 603,01 zł/mies.; 40%: 13,16 mln
  zł; 30%: 641 mln zł; 20%: 32,3 mld zł albo 538 mln zł/mies. (podstawa B1,
  D1). Koszt obliczeń: 480 kroków × źródła × 4 scenariusze — pomijalny ✓.
- **Komponent kliencki a „Server Components”:** STACK 3 mówi o stronach
  jako Server Components, ale wykres majątku (`NetWorthChart.tsx`) już jest
  komponentem `"use client"` osadzonym w stronie serwerowej. Model
  „serwer liczy, klient przycina horyzont” jest zgodny z tym wzorem ✓;
  brakuje tylko opisu, gdzie liczą się wielkości zależne od horyzontu (N1).
- **Kurs NBP na Prognozie:** `resolveCurrentRate` pobiera tabele NBP
  w renderze strony. Zgodne z jedynym dozwolonym połączeniem (SPEC 10),
  ale sprzeczne z dosłownym scen. 47 (review B, B2); STACK powinien wprost
  mówić, że Prognoza używa tej funkcji (N8).
- **Nawigacja:** `NAV_TABS` (5 zakładek) i `ThemeToggle` w `railFoot`
  widocznym w dolnej belce; `e2e/layout.spec.ts` sprawdza dziś pięć
  zakładek i widoczny przycisk motywu przy 360 px (N3).
- **Migracja T28:** jedna kolumna dodająca z CHECK, bez zmiany danych;
  poziom 2 i `private:dump` po merge'u słusznie w planie ✓.
- **Sprzeczności SPEC–STACK–PLAN:** CHECK `expected_return` od −5000 do
  5000 = SPEC 7.1 ✓; horyzont i scenariusz jako stan klienta = P28 ✓;
  „zmiana horyzontu nie wysyła żądania” (T29) mocniejsza niż scen. 47 ✓;
  T27 kryterium 40 lat vs STACK „błąd domeny” ✗ (B1).

## 5. Uwagi nieblokujące

- **N1. Wielkości zależne od horyzontu.** Karty scenariuszy, „Wpłaty
  kontra zysk”, udział zysku, „każda złotówka”, progi (zależą od majątku
  +15% na koniec horyzontu) i wartości źródeł na koniec horyzontu zmieniają
  się z horyzontem. STACK mówi tylko o przycinaniu serii. Dopisać, że T27
  dzieli domenę na „serie 40 lat” (serwer) i czystą funkcję „podsumowanie
  dla horyzontu N” importowaną w komponencie klienckim, oraz że serwer
  przekazuje serie per źródło dla scenariusza bazowego (tabela źródeł).
- **N2. Walidacja stopy w dwóch zadaniach równoległych.** T27 i T28 obie
  mają „walidację stopy z SPEC 7.1”. Przypisać parser stopy do T28 (obok
  innych parserów w `src/domain/input.ts`), a T27 zostawić walidację
  horyzontu — inaczej powstaną dwie wersje.
- **N3. Istniejące testy nawigacji.** `e2e/layout.spec.ts` („pięć
  zakładek”, przycisk motywu widoczny przy 360 px) i `src/ui/nav.test.ts`
  trzeba zmienić w T29; dopisać to do rezultatu. Przy sześciu zakładkach
  nazwa „Ustawienia” mieści się w ok. 54 px przy 10,5 px — prawdopodobnie
  ucięta wielokropkiem; kryterium T29 może wymagać nieuciętych nazw (raport
  B, uwaga 3).
- **N4. Zaokrąglenie ze znakiem.** Pomocnicze funkcje w `arithmetic.ts`
  działają tylko dla wartości nieujemnych, a zysk miesiąca przy ujemnej
  stopie wymaga zaokrąglenia połówek od zera (reguła 6.14). T27: nowa
  funkcja z testami dla −0,5 gr, −1,5 gr i stopy −50%.
- **N5. Nazwa modułu.** `src/domain/forecast.ts` to już prognoza celu
  (reguły 6.12–6.13). Nowy moduł nazwać jednoznacznie, np.
  `wealth-forecast.ts`.
- **N6. R a SPEC 8.** PLAN mówi, że R jest „gotowe” po merge'u
  z aktualizacją SPEC 8, i że R jest już zmergowane — ale SPEC 8 nadal
  opisuje wariant B. Albo dopisać zadanie aktualizacji SPEC 8, albo
  poprawić zdanie o kryterium.
- **N7. Wiersz `settings` w modelu danych** zmienia wcześniejszy zapis
  („`eur_rate` zmienia znaczenie”) na stan z kodu (`fallback_eur_rate`).
  To poprawka dokumentacji poza zakresem zmiany — wspomnieć w opisie PR.
- **N8. Kurs na Prognozie.** Dopisać w STACK „Prognoza majątku”, że strona
  używa `resolveCurrentRate` (z leniwym pobraniem NBP), a E2E kieruje
  `NBP_API_URL` na kursy z helpera, jak inne ekrany.
- **N9. Dodatkowe przypadki T27:** miesiące z przychodem z przerwą (np.
  luka 3 miesięcy w ostatnich 6), bieżący miesiąc już rozliczony (Z19),
  zaległy nierozliczony miesiąc (review B, D2), zysk dokładnie 0 i majątek
  końcowy 0 (review B, B1), suma zaokrąglonych części legendy.

## 6. Ponowne review (c916fdd)

Zakres: `git diff 79c1c8a..c916fdd -- PLAN.md STACK.md` w odniesieniu do
poprawionego SPEC (P31, P32, scen. 48).

**Werdykt: APPROVE.**

Ustalenia blokujące:
- **B1 — rozwiązane.** Stopa do 20% (P31) w SPEC 7.1, CHECK
  `expected_return` od −5000 do 2000, STACK „Arytmetyka” z progami
  przekroczenia (ok. 32 mld zł / 538 mln zł miesięcznie — zgodne z moim
  przeliczeniem 32,3 mld / 538,1 mln) i błędem domeny tylko jako
  zabezpieczeniem; kryterium T27 „źródło 2 mld zł ze stopą 20% przez 40
  lat” jest wykonalne (przeliczone: 5 581 495 985 202,74 zł, w zakresie).
  Decyzja 9.9 zapisuje wybór „zakres zamiast `BigInt` do formatowania”.
- **B2 — rozwiązane.** T29: E2E dla scen. 40–42, 43 (część Prognozy),
  44–48 oraz stanów „brak źródeł”, „brak przychodu”, „brak kursu” i pul 0%;
  STACK 7: przepływy 40–48 jako E2E, obliczenia 40–42, 45, 48 jako testy
  jednostkowe. Każdy scenariusz 40–48 ma właściciela.

Uwagi nieblokujące z rozdz. 5: N1 (podział na serie 40 lat i
podsumowanie dla horyzontu w komponencie klienckim), N2 (parser stopy
tylko w T28, `input.ts`), N3 (`nav.test.ts`, `e2e/layout.spec.ts`), N4
(zaokrąglenie ze znakiem, testy −0,5 i −1,5 gr), N5 (`wealth-forecast.ts`),
N8 (`resolveCurrentRate`, `NBP_API_URL` w E2E), N9 (przypadki T27) —
uwzględnione. N6 (R a SPEC 8) zapisane w PLAN jako otwarte poza zakresem.
N7 bez zmian (do opisu PR).

Sprawdzone ponownie:
- Spójność SPEC–STACK–PLAN: zakres stopy (7.1, scen. 43, STACK model
  danych i „Dane”, T28) ✓; scen. 48 w zakresie PLAN, T26 („1–28 i 34–48”),
  T27, T29, STACK 7 ✓; scen. 47 i P27 zgodne z opisem strony w STACK ✓;
  Z19/P32 nie wymaga zmian w planie poza przypadkiem T27 ✓.
- Zależności i równoległość bez zmian: T27 ∥ T28 (parser stopy już tylko
  w T28, więc bez duplikatu), T29 po obu ✓.
- Liczby scen. 48 (55 421 / −16 579 / −1 490 zł) przeliczone — szczegóły
  w ponownym review B.
- `prettier --check` dla SPEC, STACK i PLAN przechodzi.

Nowe uwagi nieblokujące:
1. Kryterium T29 „bez uciętych nazw zakładek” przy 360 px: przy obecnym
   CSS (`MainNav.module.css`: 10,5 px, ok. 54 px na nazwę) „Ustawienia”
   raczej się nie zmieści — T29 będzie musiało zmienić rozmiar albo odstępy
   belki; warto, żeby test sprawdzał `scrollWidth ≤ clientWidth` etykiety.
2. T27: dopisać przypadek „zysk ujemny z połówką” (np. 22 lata w scen. 48),
   żeby kwota w zdaniu była ta sama co w legendzie (ponowne review B,
   uwaga 1).
