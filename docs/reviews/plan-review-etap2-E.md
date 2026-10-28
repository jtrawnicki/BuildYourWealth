# Review planu (etap E): Etap 2 w PLAN.md i STACK.md @ eb5ff64

Reviewer niezależny od autora planu. Zakres: rozdział „Etap 2” w `PLAN.md`
(T17–T26, M7–M11, graf, pytania do review) i zmiany Etapu 2 w `STACK.md`
(`git diff origin/main...HEAD -- PLAN.md STACK.md`). Odniesienia: SPEC 5.9–5.12,
reguły 6.10–6.13, scen. 22–34, rozdz. 7, 10, 11; `docs/WORKFLOW.md`;
istniejący kod (`src/db/schema.ts`, `src/db/settlement.ts`, `src/db/sources.ts`,
`src/db/demo.ts`, `scripts/private.ts`, `scripts/private-env.ts`,
`src/domain/clock.ts`, `playwright.config.ts`, `package.json`, `.gitignore`).

## 1. Werdykt

**REQUEST CHANGES** + **HUMAN DECISION** (D1–D4).

Kierunek jest dobry: fundamenty danych (T17, T18) i czysta domena (T21) przed
UI, T17 słusznie oznaczone jako pilne, mechanizmy bez nowej infrastruktury
(leniwe pobieranie NBP zamiast crona, własny SVG zamiast biblioteki wykresów),
każdy ze scenariuszy 22–34 ma zadanie. Blokują: niespójne zależności (T23 nie
ma kolumny `deadline`), sprzeczny model stanu powiadomień (klucz unikalny
kontra ponowna próba i lista błędów), niezweryfikowane ryzyko „Harmonogram
przy starcie Windows przed Dockerem”, niebezpieczne brzmienie migracji
`fallback` na `byw_private` i brak właściciela infrastruktury testowej SMTP
oraz przekazania `SMTP_*` do procesu aplikacji.

## 2. Decyzje wymagane od człowieka

**D1. Zależność `nodemailer` i połączenia wychodzące (STACK 9.5–9.6).**
Uzasadnienie jest rzetelne: własna obsługa SMTP z STARTTLS, AUTH i kodowaniem
nagłówków (RFC 2047) to kod bezpieczeństwa, którego nie warto pisać;
`nodemailer` nie ma zależności przechodnich. Alternatywy (API Gmaila z OAuth,
zewnętrzny serwis wysyłki) są cięższe i wiążą z dostawcą.
Rekomendacja: **zaakceptować**, z warunkiem w T23: dla hosta innego niż
`localhost` transport wymaga TLS (`secure` albo `requireTLS`), żeby hasło
i kwoty nie poszły otwartym tekstem.
W sprawie pytania autora 1 (P8 a P15): SPEC 10 i STACK 9.6 opisują wyjątek
wystarczająco; brakuje tylko powyższego wymogu TLS.

**D2. Założenia Z10–Z16 (pytanie autora 2).** Rekomendacja: zaakceptować
Z10–Z15 bez zmian. Z16 zaakceptować z doprecyzowaniem: wygenerowane kursy
rozliczeń w demo nie mogą być podpisane „NBP, <data>” w Historii (publiczna
strona pokazywałaby fałszywy kurs NBP). Warianty: (a) generator oznacza je
jako `fallback` („kurs zapasowy”) — rekomendowany, zero kodu; (b) generator
bierze prawdziwe kursy z `exchange_rates` (zależność demo od NBP przy
tworzeniu piaskownicy).

**D3. Docker Desktop przy logowaniu (STACK 9.7).** Codzienne sprawdzenie
działa tylko, gdy Docker Desktop startuje sam po zalogowaniu („Start Docker
Desktop when you sign in”). To zmiana konfiguracji komputera właściciela;
alternatywą jest pogodzenie się z tym, że maile wychodzą tylko w dni, gdy
właściciel ręcznie uruchomi Dockera. Rekomendacja: włączyć autostart Dockera
i zapisać to jako wymaganie w AGENTS.md (T24). Patrz też B3.

**D4. Zależność od R (pytanie autora 3).** Gałąź `feat-portfel-reskin` zmienia
m.in. `src/app/(app)/MonthPlan.tsx` i `src/app/(app)/majatek/page.tsx`, czyli
dokładnie miejsca, które zmienia T19 (druga linia EUR, kurs na Majątku),
a nie zmienia `ustawienia/`, `rozliczenie/*/actions.ts` ani `src/db/`.
Rekomendacja: T19 czeka na R, ale jego część danych (kolumny rozliczenia,
wybór kursu przed transakcją, zapis pochodzenia) można zrobić od razu, jeśli
T19 zostanie podzielone (N6). R nie ma Issue ani kryterium „zmergowane”;
warto mu je dać, skoro blokuje cztery zadania.

## 3. Problemy blokujące

**B1. Zależności w grafie nie zgadzają się z opisami i z potrzebami zadań.**
- T23 ma wysyłać mail „Cel zagrożony” (scen. 32: status zależy od terminu),
  ale kolumnę `goals.deadline` dodaje dopiero T22, które czeka na R. T23
  „zależy od T21” nie da się więc zakończyć ze scen. 32, a gałąź
  powiadomień (T23–T25) jest faktycznie zablokowana przez R.
  Poprawka: przenieść kolumnę `goals.deadline` (migracja, CHECK „termin tylko
  z kwotą docelową”, zapis i odczyt w `db/plan.ts`, „usunięcie kwoty
  docelowej usuwa termin” na poziomie `db/`) do zadania bez UI — najprościej
  do T21 („Termin i prognoza: dane i domena”) — i zostawić T22 tylko UI.
  Graf: T21 ─ T23 staje się prawdziwe.
- T20: graf rysuje T20 za T19 (`T19 ─┼─ T20`), opis mówi „Zależy od: T17, T18,
  R”. Oba zadania zmieniają `majatek/page.tsx`, więc kolejność T19 → T20 jest
  zasadna; ujednolicić opis („T17, T19, R”) albo graf.
- T24 zmienia akcję rozliczenia (`after()`), którą zmienia też T19; dopisać
  T19 do zależności T24 albo zaznaczyć, że nie idą równolegle.
- Kto dodaje kolumny: `settings.notify_*` — T23 (OK), `months.settled_rate_*`
  — T19 (OK), `goals.risk_notified` — T23 (OK), `goals.deadline` — patrz wyżej.

**B2. Model stanu powiadomień jest wewnętrznie sprzeczny (STACK
„Powiadomienia”, T23).**
- „Unikalne (user_id, dedupe_key)” + „błąd SMTP zapisuje `error` i zwalnia
  klucz”: jeśli wiersz z błędem zostaje, unikalny klucz blokuje ponowną próbę;
  jeśli jest usuwany, lista 10 ostatnich maili nie pokaże błędu (SPEC 5.10,
  scen. 33).
- Proces przerwany między `INSERT` a SMTP (zamknięcie aplikacji, uśpienie
  komputera, Ctrl+C w `private:start`) zostawia wiersz bez `sent_at`
  i `error`; mail nie wyjdzie nigdy.
- Gdzie i kiedy zeruje się `risk_notified`? Scen. 32 (marzec → grudzień)
  może zajść między dwoma sprawdzeniami; jeśli zeruje je tylko sprawdzenie,
  nowy mail nie wyjdzie. Klucz `goal-risk:<cel>:<data>` nie mówi, jaka to data.
- Grupa „Rozliczenie” liczy 7 dni od „poprzedniego maila tej grupy” — trzeba
  napisać, że liczy się tylko mail wysłany (`sent_at`), nie próba z błędem.

Poprawka w STACK: (1) jeden wiersz na klucz, ponowna próba przez warunkowe
przejęcie istniejącego wiersza (`UPDATE … SET claimed_at = now() WHERE
sent_at IS NULL AND (error IS NOT NULL OR claimed_at < now() - interval
'10 min') RETURNING`), błąd nadpisuje `error`, więc lista pokazuje ostatni
stan; albo indeks unikalny częściowy `WHERE error IS NULL` i osobne wiersze
prób. (2) `risk_notified` zerowane przez sprawdzenie, gdy status ≠
„zagrożony”, oraz przez zapis celu, gdy zmienia się termin albo kwota
docelowa; klucz `goal-risk:<cel>:<chwila ustawienia flagi>`.
(3) Kryteria T23: test „proces przerwany po INSERT”, test scen. 32 bez
sprawdzenia między zmianami terminu, test równoległy dwóch sprawdzeń
z różnych połączeń (nie dwóch wywołań w jednym połączeniu).

**B3. Ryzyko Harmonogramu zadań nie jest zweryfikowane, a typowy przypadek
je łamie (STACK „Harmonogram zadań”, T24).** `StartWhenAvailable` uruchamia
pominięte zadanie zaraz po zalogowaniu, czyli zwykle zanim Docker Desktop
wstanie (30–90 s). `docker compose up -d --wait` kończy się wtedy błędem,
a „następne uruchomienie nadrabia” oznacza następny dzień — przy komputerze
włączanym wieczorem po godzinie wyzwalacza scenariusz powtarza się codziennie
i maile z Harmonogramu nie wychodzą nigdy. Opcja ponowienia zadania
w Harmonogramie dotyczy nieudanego uruchomienia, a nie niezerowego kodu
wyjścia skryptu, więc jej nie zastąpi. Do tego plan nie mówi o katalogu
roboczym zadania, ścieżce do `node`/`npm` w środowisku zadania ani o oknie
konsoli otwieranym codziennie na pulpicie.
Poprawka w T24: `private:notify` czeka na Dockera (np. odpytuje `docker info`
do 5 min) zanim zgłosi błąd; zadanie ma wyzwalacz codzienny i wyzwalacz przy
logowaniu z opóźnieniem; akcja ma ustawiony katalog roboczy i pełną ścieżkę
do Node; okno ukryte. Kryterium akceptacji: ręczny test właściciela
„wyloguj → zaloguj z wyłączonym Dockerem → mail wychodzi bez ręcznej
akcji”. Brak uprawnień administratora (zadanie dla bieżącego użytkownika,
logowanie interaktywne, `RunLevel Limited`) zgodnie z dokumentacją
Microsoftu nie wymaga podniesienia — nie sprawdziłem tego empirycznie
(rejestracja zadania zmienia konfigurację systemu); kryterium T24 słusznie to
weryfikuje.

**B4. Migracja `settled_rate_*` na `byw_private` w obecnym brzmieniu jest
błędna (STACK model danych, T19).** „Miesiące rozliczone przed Etapem 2
dostają `fallback` i datę rozliczenia” — ale `settleMonth` zapisuje
`settled_eur_rate` tylko, gdy miesiąc ma cel EUR (`hasEur ? rate : null`,
`src/db/settlement.ts`). Dosłowne wykonanie oznaczy miesiące bez kursu jako
„kurs zapasowy”, a Historia pokaże pochodzenie kursu, którego nie ma. Data
rozliczenia wpisana w kolumnę „data tabeli” miesza dwa znaczenia (SPEC
pokazuje kurs zapasowy bez daty: „4,3000 zł · kurs zapasowy”).
Poprawka: migracja ustawia `settled_rate_source = 'fallback'` tylko tam, gdzie
`settled_eur_rate IS NOT NULL`; `settled_rate_date` dla `fallback` = null
(albo jawnie opisana jako „dzień rozliczenia”); CHECK spójności: rate, source
(i date dla `nbp`) albo wszystkie null. Kryterium T19: test migracji na
danych MVP z miesiącem z celem EUR i bez. To samo zadanie musi też ustalić,
czy rozliczenie bez celu EUR w ogóle pobiera kurs (rekomendacja: nie).
Ten sam problem ma generator demo (`writeDemoData` zapisuje
`settledAt: now` dla wszystkich rozliczonych miesięcy): historia wartości
„zgodna z rozliczeniami” z T17 i reguła 30 dni z Z12 wymagają realnych dat
rozliczeń (np. kilka dni po końcu miesiąca). Dopisać do T17.

**B5. Brak właściciela infrastruktury testowej SMTP i przekazania `SMTP_*`
do aplikacji.**
- T25 wymaga „E2E w obu trybach z atrapą SMTP”, a scen. 33 „Nie udało się
  wysłać” przy złym haśle — w E2E transportu nie da się wstrzyknąć do
  działającego `next start`, potrzebny jest lokalny serwer SMTP odrzucający
  AUTH. Żadne zadanie go nie tworzy (dla NBP atrapę tworzy T18).
  Poprawka: T23 dostarcza minimalną atrapę SMTP dla E2E (np. `node:net`,
  bez nowej zależności) z trybem „odrzuć AUTH” i odczytem odebranych maili,
  podłączoną w `playwright.config.ts`.
- `privateProcessEnv` (`scripts/private-env.ts`) przekazuje z `.env.private`
  wyłącznie `DATABASE_URL`. Bez zmiany `SMTP_*` nie dotrą ani do `next start`
  (testowy mail, `after()` po rozliczeniu), ani do `private:notify`. Z drugiej
  strony `next start` sam wczytuje `.env` z katalogu repozytorium, więc
  deweloperskie `NBP_API_URL` czy `SMTP_*` z `.env` przeciekłyby do wersji
  prywatnej (osłona `VERCEL_ENV` nie działa lokalnie).
  Poprawka w T24: `private-env` parsuje i przekazuje `SMTP_*`, a jawnie
  ustawia/czyści `NBP_API_URL` (i `E2E_NOW`); test w `private-env.test.ts`.

## 4. Weryfikacja wykonana przez reviewera

- **Mapa scenariuszy → zadania i rodzaj testu:** 22, 23, 24 — T19 (E2E
  z atrapą NBP + integracyjne rozliczenia; jednostkowe reguły 6.10 w T18);
  25, 26 — T20 (jednostkowe 6.11, E2E), historia z T17 (integracyjne);
  27, 28 — T21 (jednostkowe) i T22 (E2E); 29–32 — T23 (jednostkowe
  z wstrzykniętym `now`, integracyjne wysyłki); 33 — T23 (retry, brak
  konfiguracji, wyłączona grupa) i T25 (UI, testowy mail; brak atrapy SMTP,
  B5); 34 — T20 (wykres), T22 (statusy), T25 (podgląd), T23 (demo bez SMTP).
  Każdy ma właściciela; luka tylko w infrastrukturze (B5) i w zależności
  scen. 32 (B1).
- **Graf vs opisy:** rozbieżności w T20, T23, T24 (B1).
- **`after()` w tej wersji Next.js:** `node_modules/next` 16.4.2,
  `dist/docs/01-app/03-api-reference/04-functions/after.md` — `after`
  z `next/server` działa w Server Functions, stabilne od 15.1, wspierane
  przy serwerze Node.js (`next start`). Uwaga z dokumentacji: callback
  wykona się także po `redirect()` i po błędzie — wywołanie `after()` tylko
  po wyniku `ok` (N2).
- **API NBP** (api.nbp.pl): zapytanie o zakres najwyżej 93 dni; brak danych
  dla poprawnego zakresu → 404 Not Found; błędne zapytanie → 400; tabela
  z dzisiaj przed publikacją → 404; adres
  `/api/exchangerates/rates/{table}/{code}/{startDate}/{endDate}/` zgodny ze
  STACK. Dokumentacja nie podaje limitu liczby zapytań.
- **Kod rozliczenia** (`src/db/settlement.ts`): blokada `FOR UPDATE` wiersza
  miesiąca, kurs czytany z `settings` w transakcji, `settled_eur_rate` tylko
  przy celu EUR (podstawa B4); jedyne zapisy `sources.value`: `createSource`,
  `updateSource`, `settleMonth`, `writeDemoData` (+ archiwizacja wymaga
  value = 0) — lista ścieżek w T17 kompletna.
- **Skrypty prywatne:** `scripts/private.ts`, `scripts/private-env.ts`
  (podstawa B5), `.gitignore` (brak `logs/`, N4), `.env.private.example`.
- **Ryzyko konfliktów z R:** `git diff --stat main...feat-portfel-reskin`
  — 20 plików, wyłącznie `src/app/(app)/*` (strony, CSS), `src/ui/*`,
  `e2e/layout.spec.ts`; brak `src/db`, `src/domain`, `scripts`. T17, T18,
  T21, T23 nie kolidują z R; T19 i T20 kolidują w `majatek/page.tsx`
  i `MonthPlan.tsx` (D4).
- **Zależności:** `nodemailer` — brak zależności przechodnich (zgodnie
  z uzasadnieniem w STACK 2); potrzebny też `@types/nodemailer` (dev).
- Nie sprawdzono empirycznie: rejestracji zadania w Harmonogramie bez
  uprawnień administratora (zmiana konfiguracji systemu; B3).

## 5. Uwagi nieblokujące

- **N1. `rate_fetches`.** Potrzebna jest jakaś pamięć nieudanej próby, bo bez
  niej przy niedziałającym NBP każda strona czeka 3 s. Wystarczy jeden wiersz
  na walutę (PK `currency`, upsert), nie log prób; ewentualnie pamięć procesu
  (wersja prywatna to jeden proces). Doprecyzować w STACK, że to jeden wiersz.
- **N2. `after()` po rozliczeniu** wywoływać tylko po `status: "ok"`;
  `userId` przekazać do callbacku, nie czytać sesji w środku.
- **N3. Sprawdzenie w `private:start` przed `next start`** bez internetu może
  opóźnić start aplikacji o domyślne limity czasu `nodemailer` (minuty).
  Ustawić krótkie `connectionTimeout`/`greetingTimeout` albo uruchamiać
  sprawdzenie równolegle ze startem serwera.
- **N4. `logs/notify.log`** leży w katalogu repozytorium i zawiera adres
  e-mail i tematy z kwotami — dopisać `/logs/` do `.gitignore` w T24.
- **N5. `private:notify` z Harmonogramu stosuje migracje.** Po `git pull`
  zadanie może zmigrować `byw_private` przed ręcznym `private:dump`, wbrew
  procedurze „kopia przed aktualizacją z migracją”. Rekomendacja: notify
  nie migruje; przy oczekujących migracjach kończy się czytelnym błędem
  („uruchom private:start”). Do instrukcji po merge'u T17 dopisać
  `npm run private:dump` przed `private:start` (pierwsza migracja z danymi na
  `byw_private`).
- **N6. Rozmiar T19 i T23.** T19 obejmuje migrację, rozliczenie, Ustawienia,
  Majątek, „Ten miesiąc”, Historię i generator; T23 tabelę, kolumny,
  wybór maili dla trzech grup, treści i wysyłkę. Rozważyć podział: T19a dane
  i rozliczenie (bez plików R) / T19b wyświetlanie; T23a czysta funkcja wyboru
  i treści / T23b wysyłka i deduplikacja.
- **N7. Leniwe pobieranie NBP — doprecyzować:** (a) kiedy tabela „powinna
  istnieć” (dzień roboczy po ok. 12:30 Warsaw; święta dadzą 404 raz na
  godzinę, co jest akceptowalne); (b) 404 dla zakresu to „brak nowych
  tabel”, nie błąd; (c) zakres pierwszego pobrania przy pustej tabeli (od
  początku miesiąca wdrożenia i od końca najstarszego nierozliczonego
  miesiąca minus 7 dni); (d) demo potrzebuje kursów z końców 12 miesięcy
  dla wykresu — pierwsze wejście pobierze 4 zakresy; dopisać do kryteriów
  T20.
- **N8. Atrapa NBP w E2E może być prostsza:** kursy można wstawiać do
  `exchange_rates` przez helper E2E, a `NBP_API_URL` kierować na zamknięty
  port (scen. 24 „NBP nie odpowiada”). Serwer atrapy potrzebny tylko, jeśli
  któryś test sprawdza samo pobieranie.
- **N9. Kurs na ekranie rozliczenia a kurs przy zatwierdzeniu.** Między
  otwarciem ekranu a zatwierdzeniem może pojawić się nowa tabela (ostatni
  dzień miesiąca po 12:00). Formularz przesyła datę tabeli, a akcja odrzuca
  zapis, gdy kurs rozliczenia się zmienił (jak „Ten miesiąc jest już
  rozliczony”), zamiast przeliczać kwoty po cichu.
- **N10. Scen. 12 dla nowych elementów** jest w kryteriach tylko T20;
  dopisać do T22 (Plan, „Ten miesiąc”) i T25 (Ustawienia).
- **N11. Podgląd maili w demo** z generatorem, który ma cel osiągnięty
  i rozliczenia z „teraz”, zawsze pokaże „Cel osiągnięty”; po poprawce dat
  rozliczeń (B4) zachowanie wynika z reguły 30 dni — warto to świadomie
  sprawdzić w teście generatora.
- **N12. Migracja `initial` (T17)** — `recorded_at = now()` w chwili migracji,
  także dla źródeł zarchiwizowanych (wartość 0); migracja zawiera ręcznie
  dopisany `INSERT … SELECT` w pliku drizzle — wymienić w kryteriach, że
  `drizzle-kit generate` po niej nie produkuje różnicy w snapshotcie.

## 6. Rozstrzygnięcia (autor planu, 2026-10-27)

Właściciel produktu przyjął wszystkie rekomendacje.

- **D1:** `nodemailer` zaakceptowany z wymogiem TLS dla hosta innego niż
  `localhost` (STACK 2, 9.5; SPEC 10, P15).
- **D2:** Z10–Z16 zaakceptowane; kursy rozliczeń w demo jako `fallback`
  (SPEC Z16, STACK „Kurs NBP”).
- **D3:** autostart Docker Desktop jako wymaganie (SPEC P21, STACK 9.8,
  T24).
- **D4:** T19 podzielone na T19a (dane i rozliczenie, bez R) i T19b
  (ekrany, po R); R dostaje własne Issue.
- **B1:** `goals.deadline` przeniesione do T21; graf przepisany (T20 po
  T19b, T24 po T19a i T23b).
- **B2:** jeden wiersz na mail z przejęciem (`claimed_at`) i nadpisywanym
  `error`; `risk_notified_at` zerowane przy sprawdzeniu i zapisie celu;
  sprawdzenie po zapisie planu (SPEC 5.10); 7 dni od `sent_at`; testy
  w T23b.
- **B3:** `private:notify` czeka na Dockera, wyzwalacz przy logowaniu
  z opóźnieniem, katalog roboczy, ścieżka do `node`, ukryte okno; ręczny
  test w T24.
- **B4:** migracja `manual` tylko dla miesięcy z kursem, CHECK spójności,
  rozliczenie bez celu EUR bez kursu (T19a); daty rozliczeń w generatorze
  (T17).
- **B5:** atrapa SMTP na `node:net` w T23b; `private-env` przekazuje
  `SMTP_*` i czyści `NBP_API_URL` (T24).
- **Uwagi nieblokujące** uwzględnione: N1 (jeden wiersz `rate_fetches`),
  N2 (`after()` tylko po sukcesie), N3 (krótkie limity, sprawdzenie
  równolegle ze startem), N4 (`/logs/`), N5 (notify bez migracji,
  `private:dump` w instrukcji po T17), N6 (podział T19 i T23), N7 (zasady
  leniwego pobierania), N8 (kursy z helpera zamiast serwera atrapy NBP),
  N9 (odrzucenie przy zmianie kursu), N10 (scen. 12 w T19b, T22, T25),
  N11 (podgląd demo w kryteriach T23a), N12 (kryteria migracji T17).
