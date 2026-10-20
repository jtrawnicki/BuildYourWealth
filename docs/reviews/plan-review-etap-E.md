# Review planu (etap E): PLAN.md @ c287a19

Reviewer niezależny od autora planu. Sprawdzone: PLAN.md, STACK.md, SPEC.md,
docs/WORKFLOW.md, makieta B3 (`docs/design/b3-plan-podzialu.dc.html`) oraz
środowisko chmurowej sesji agenta (narzędzia dostępne w kontenerze).

## 1. Werdykt

**REQUEST CHANGES** (drobne poprawki planu) + **HUMAN DECISION** (pytanie 1).
Struktura planu jest dobra: ryzyko integracji na początku, domena jako czyste
funkcje przed UI, każdy z 18 scenariuszy SPEC 12 ma przypisane zadanie,
brak scope creep poza jednym punktem (B4). Po poprawkach B1–B6 plan spełnia
bramę etapu E.

## 2. Decyzje wymagane od człowieka

**D1. Usunięcie ostatniej pozycji przychodu** (pytanie autora). To decyzja
produktowa, bo zmienia widoczne zachowanie i wymaga poprawki SPEC. Dodatkowy
argument, którego autor nie wskazał: SPEC 7 ma wiersz „Przychód 0 zł … rozliczenie
możliwe”, a SPEC 7.1 wymaga kwoty przychodu > 0. Miesiąc z przychodem 0 zł
może więc powstać *tylko* przez usunięcie wszystkich pozycji, czyli SPEC
sugeruje dziś wariant „miesiąc zostaje”. Warianty:

- **A (rekomendowany): miesiąc znika.** Wraca pusty stan, pigułka zaległości
  znika, ponowny przychód tworzy miesiąc z planem obowiązującym w tej chwili
  (stara migawka przepada, nic nie było rozliczone, więc nic nie ginie).
  Uwaga: zaległy miesiąc starszy niż poprzedni (np. wrzesień w listopadzie)
  po usunięciu nie da się już odtworzyć; to spójne z „miesiąc bez przychodu
  nie wymaga rozliczenia”. Wymaga poprawki SPEC 7: wiersz „Przychód 0 zł lub
  pula 0%” → „Pula 0%” oraz nowy wiersz „Usunięcie wszystkich przychodów
  miesiąca”.
- **B: miesiąc zostaje z przychodem 0 zł** i migawką planu, czeka na
  rozliczenie z kwotami 0,00. Zgodny z obecnym brzmieniem SPEC 7, ale zmusza
  do rozliczania pustego miesiąca.

Decyzja trafiła do Jakuba jako karta wyboru.

## 3. Problemy blokujące

**B1. Podmiana czasu w E2E nie ma właściciela i ma wadliwy warunek.**
STACK 5 („Czas i miesiące”) przewiduje zmienną środowiskową podmieniającą
`now` „tylko poza produkcją”, ale żadne zadanie jej nie tworzy, a potrzebują
jej E2E scen. 4, 5, 7, 15, 18 oraz T12 („przed ostatnim dniem niedostępne”).
Do tego `npm run e2e` działa na zbudowanej aplikacji (STACK 7), czyli
z `NODE_ENV=production`, więc warunek oparty na `NODE_ENV` wyłączy podmianę
w testach, a słabszy warunek grozi włączeniem jej na Vercel.
Poprawka: dopisać do T6 (albo T10) rezultat „podmiana zegara dla E2E”
z kryterium: działa tylko przy jawnej fladze testowej i braku `VERCEL_ENV`;
test potwierdza, że przy `VERCEL_ENV=production` flaga jest ignorowana.

**B2. Brak infrastruktury danych testowych E2E.** Od T3 każde zadanie robi E2E
na wspólnej bazie, ale żadne zadanie nie dostarcza: zakładania konta testowego,
logowania w fixture Playwright i czyszczenia bazy między testami. Bez tego
pierwszy implementer każdego ekranu wymyśli to inaczej. Poprawka: dopisać do
T3 (rezultat i kryterium) fixture „zalogowany użytkownik na czystej bazie”
oraz helper seedujący dane przez `db/` (potrzebny T8–T14, gdzie stan wymaga
celów, miesięcy lub rozliczeń, zanim UI do ich tworzenia istnieje).

**B3. Postgres w sesji agenta.** W kontenerze chmurowej sesji `docker` jest
zainstalowany, ale demon nie działa (`docker info` kończy się błędem), więc
kryterium T1 „`docker compose up db`” nie przejdzie w sesji agenta, a STACK 6
zakłada właśnie to. W kontenerze jest za to serwer PostgreSQL 16
(`pg_ctlcluster`). Poprawka w T1: bramka działa z dowolnym Postgresem
wskazanym przez `DATABASE_URL`; `AGENTS.md` opisuje oba sposoby (Docker
lokalnie, lokalny klaster w sesji chmurowej), a kryterium akceptacji obejmuje
uruchomienie `npm test` w sesji agenta. Rozważyć hook SessionStart, który
startuje klaster i tworzy bazę.

**B4. Scope creep w T9: „kolejnością”.** SPEC 5.3 i makieta B3 nie przewidują
zmiany kolejności celów (brak elementu do przesuwania). Kolumna `position`
z STACK 4 może zostać do stabilnego sortowania wg kolejności dodania, ale
UI zmiany kolejności trzeba usunąć z rezultatu T9.

**B5. Wersja Postgresa: Neon vs CI vs `pg_dump`.** `pg_dump` odmawia zrzutu
z serwera nowszego niż on sam. W kontenerze agenta jest `pg_dump` 16, a Neon
domyślnie tworzy projekty na nowszej wersji. Poprawka: T1 i T2 przypinają
w `compose.yaml` i CI tę samą główną wersję co projekt Neon, a T4 w kryterium
`db:dump` wskazuje, gdzie skrypt jest uruchamiany i jaka wersja klienta jest
wymagana. (Jakub dostał informację, żeby zanotować wersję przy zakładaniu Neon.)

**B6. Niespójne zależności T7.** Graf: `T3 + T6 + T7a ─ T7`; opis T7:
„Zależy od: T3, T5, T7a”. Ujednolicić (T5 wystarcza do walidacji kursu).

## 4. Weryfikacja wykonana przez reviewera

- Mapa scenariuszy SPEC 12 → zadania: każdy z 1–18 ma właściciela
  (1: T6/T11, 2: T6, 3: T6/T9, 4: T12, 5: T12/T14, 6: T6/T12, 7: T13,
  8: T10/T14, 9: T8, 10: T11, 11: T6/T12, 12: T7a/T11/T15, 13: T3/T15,
  14: T6/T11, 15: T12, 16: T8/T11, 17: T6, 18: T10).
- Sprawdzone pokrycie SPEC 5.2–5.7, 6 i 7 przez rezultaty zadań; luki
  w uwagach N3, N4.
- Makieta B3: brak UI zmiany kolejności celów (podstawa B4).
- Kontener sesji: `docker info` błąd, PostgreSQL 16 i `pg_dump` 16.15
  dostępne, Node 22 (podstawa B3, B5).
- Spójność grafu zależności z opisami zadań (B6).

## 5. Uwagi nieblokujące

- **N1. T4: dwa adresy bazy.** Aplikacja na Vercel powinna używać adresu
  z poolerem Neon, a migracje w buildzie adresu bezpośredniego (Neon daje
  oba). Warto to zapisać w rezultacie T4.
- **N2. T4: zabezpieczenie przed podglądami.** Oprócz wyłączenia podglądów
  ustawić `DATABASE_URL` tylko w zakresie „Production” w Vercel; kryterium:
  push na gałąź inną niż `main` nie tworzy deploymentu z dostępem do bazy.
- **N3. Scen. 13 rośnie z każdym ekranem.** T3 testuje tylko strony istniejące
  w T3. Dopisać w `AGENTS.md` (T1) konwencję: każda nowa strona i Server Action
  dostaje test „bez sesji brak danych”, albo jeden test iterujący po wszystkich
  trasach.
- **N4. Komunikat błędu zapisu (SPEC 7).** T7a tworzy komponent, ale żadne
  kryterium nie sprawdza, że formularz zachowuje dane po błędzie. Dodać jeden
  test (np. w T7) z wymuszonym błędem akcji.
- **N5. Pasek majątku na „Ten miesiąc” bez kursu** (SPEC 7: prośba o kurs przed
  sumą majątku) jest wymieniony tylko w T8; dopisać do kryteriów T11.
- **N6. T4 zależy od T3.** Można rozważyć podłączenie Vercel już po T2
  (migracje w buildzie to większe ryzyko niż logowanie), ale obecna kolejność
  jest akceptowalna, bo smoke test i tak wymaga logowania.
- **N7. T4: wymagania wobec komputera Jakuba.** `user:set-password` i `db:dump`
  uruchamia człowiek (hasło nie przechodzi przez agenta), więc potrzebuje
  klonu repo, Node i klienta `pg_dump`. Warto wypisać to w krokach T4 z góry.
- **N8. T6 jest duże** (plan, przeliczenia, postęp, walidacja planu, czas).
  Można wydzielić funkcje czasu jako T6b równoległe do T6; nie jest to wymagane.
