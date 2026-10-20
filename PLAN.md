# BuildYourWealth: plan wykonania MVP

Status: **zatwierdzony po review etapu E (2026-10-20).**
Źródła: [`SPEC.md`](SPEC.md) (co budujemy), [`STACK.md`](STACK.md) (jak),
[`docs/WORKFLOW.md`](docs/WORKFLOW.md) (proces). Plan opisuje rezultaty,
nie kod. Po review etapu E każde zadanie dostaje Issue na GitHub, a ten plan
pozostaje mapą kolejności.

Oznaczenia:

- **Poziom** weryfikacji wg WORKFLOW rozdz. 5 (1 = mała zmiana, 2 = funkcja,
  3 = milestone).
- **Zależy od:** zadania, które muszą być zmergowane wcześniej.
- **Równolegle:** zadania, które można wykonywać jednocześnie (bez wspólnych
  plików poza oczywistymi punktami integracji).
- „Scen. N” to scenariusz akceptacyjny N z SPEC 12.

## Milestone'y

| Milestone | Działający przyrost | Zadania |
| --- | --- | --- |
| M1 Szkielet produkcyjny | Pusta aplikacja z logowaniem działa pod adresem `*.vercel.app`, CI pilnuje jakości. | T1–T4 |
| M2 Domena | Wszystkie reguły obliczeń i walidacji z SPEC 6–7 jako przetestowane funkcje. | T5–T6 |
| M3 Konfiguracja | Można ustawić kurs, motyw, źródła i plan podziału. | T7–T9 |
| M4 Ten miesiąc | Po wpisaniu przychodów widać plan przelewów (cel 1 ze SPEC 3). | T10–T11 |
| M5 Rozliczenie i historia | Rozliczenie dopisuje wpłaty do majątku, historia je pokazuje (cele 2–3 ze SPEC 3). MVP kompletne. | T12–T14 |
| M6 Wydanie | Pełna weryfikacja poziomu 3 na produkcji. | T15 |

Graf zależności:

```
T1 ─┬─ T2 ─ T3 ─ T4 (M1)
    ├─ T5 ─ T6 (M2)            ← równolegle z T2–T4
    └─ T7a (layout, motywy)    ← równolegle z T2–T4

T3 + T5 + T7a ─ T7 ─ T8 ─ T9 (M3)      ← T8 wymaga też T6
T9 ─ T10 ─ T11 (M4)
T11 ─ T12 ─ T13, T14 (M5)      ← T13 i T14 równolegle
wszystko ─ T15 (M6)
```

## M1 Szkielet produkcyjny

Cel: najwcześniej zredukować największe ryzyko z STACK 8 (integracja
Vercel + Neon + migracje + logowanie).

### T1 Inicjalizacja repozytorium i bramka jakości

- **Rezultat:** aplikacja Next.js z jedną stroną, struktura katalogów
  z STACK 3, skrypty z STACK 7, `compose.yaml` z Postgres i workflow CI
  uruchamiający bramkę z Postgres jako usługą (oba w wersji z STACK 6),
  hook SessionStart dla sesji chmurowej, który uruchamia lokalny klaster
  Postgres i tworzy bazy deweloperską i testową, przykładowy test Vitest
  i Playwright, `AGENTS.md` (jak uruchomić projekt, bramka, konwencje,
  odwołania do SPEC/STACK/PLAN/WORKFLOW bez kopiowania reguł; opis obu
  sposobów uruchomienia bazy; konwencja: każda nowa strona i Server Action
  dostaje test „bez sesji brak danych”),
  `CLAUDE.md` z jedną linią `@AGENTS.md`, `.env.example`.
- **Zależy od:** brak. **Poziom:** 1 (infrastruktura bez logiki produktu).
- **Kryteria akceptacji:** każde polecenie z STACK 7 przechodzi w CI
  i w sesji chmurowej agenta (lokalny klaster, bez Dockera); bramka działa
  z dowolnym Postgresem wskazanym przez `DATABASE_URL`; świeży klon +
  baza (Docker albo lokalny klaster) + `npm ci` + polecenia z `AGENTS.md`
  wystarczą do uruchomienia aplikacji.
- **Weryfikacja:** zielone CI na PR.

### T2 Schemat bazy, migracje i skrypty administracyjne

- **Rezultat:** schemat Drizzle wszystkich tabel z STACK 4 z ograniczeniami
  CHECK/FK/UNIQUE, pierwsza migracja SQL, skrypty `db:migrate`,
  `user:set-password` (tworzy konto lub ustawia nowe hasło), `db:dump`.
- **Zależy od:** T1. **Poziom:** 2 (dane).
- **Kryteria akceptacji:** migracja na pustej bazie tworzy schemat;
  testy integracyjne potwierdzają, że baza odrzuca ujemne kwoty, procent
  poza zakresem, kurs ≤ 0 i drugi miesiąc o tym samym `YYYY-MM`;
  `user:set-password` uruchomiony dwa razy zmienia hasło zamiast tworzyć
  drugie konto.
- **Weryfikacja:** testy integracyjne, niezależne review schematu.

### T3 Logowanie, sesje i guard dostępu

- **Rezultat:** ekran logowania w stylu wariantu B (bez makiety), sesje
  i ochrona przed zgadywaniem hasła wg STACK 5, `requireUser()`
  w każdej stronie i akcji, wylogowanie. Infrastruktura danych E2E:
  fixture Playwright „zalogowany użytkownik na czystej bazie” (konto
  testowe, logowanie, czyszczenie bazy przed każdym testem) oraz helper
  seedujący dane przez `db/` (źródła, cele, miesiące, rozliczenia), żeby
  późniejsze zadania mogły przygotować stan przed powstaniem jego UI.
- **Zależy od:** T2. **Poziom:** 2 (bezpieczeństwo).
- **Kryteria akceptacji:** scen. 13; błędne hasło daje komunikat bez
  ujawniania, czy konto istnieje; po limicie nieudanych prób kolejne próby
  są odrzucane przez ustalony czas; wylogowanie unieważnia sesję w bazie;
  ciasteczko ma `HttpOnly`, `Secure`, `SameSite=Lax`; przykładowy test E2E
  korzysta z fixture i helpera seedującego, a dwa testy uruchomione po sobie
  nie widzą swoich danych.
- **Weryfikacja:** testy jednostkowe haseł i sesji, E2E logowania
  i dostępu bez sesji, niezależne review bezpieczeństwa.

### T4 Wdrożenie produkcyjne

- **Rezultat:** projekt Vercel połączony z repozytorium (deploy tylko
  z `main`, podglądy PR wyłączone), baza Neon we Frankfurcie w wersji
  Postgres z STACK 6, aplikacja łączy się adresem z poolerem, a migracje
  w buildzie produkcyjnym adresem bezpośrednim; oba adresy ustawione
  w Vercel tylko w zakresie „Production”; konto właściciela utworzone skryptem, procedura
  wdrożenia, kopii i wycofania opisana w `AGENTS.md`.
- **Zależy od:** T3. **Poziom:** 2.
- **Wymaga człowieka:** założenie kont Vercel i Neon, połączenie Vercel
  z GitHub, wpisanie `DATABASE_URL` w Vercel, ustawienie hasła konta
  (agent podaje dokładne kroki; hasło nie przechodzi przez agenta).
  Na komputerze właściciela potrzebne są: klon repozytorium, Node
  i klient `pg_dump` w wersji co najmniej takiej jak serwer (albo Docker
  z obrazem Postgres tej wersji); lista trafia do kroków z wyprzedzeniem.
- **Kryteria akceptacji:** smoke test na `*.vercel.app`: HTTPS, logowanie,
  wylogowanie, strona bez sesji przekierowuje na logowanie; push na gałąź
  inną niż `main` nie tworzy deploymentu z dostępem do bazy; `db:dump`
  uruchomiony na komputerze właściciela tworzy plik kopii z bazy
  produkcyjnej.
- **Weryfikacja:** smoke test ręczny według listy w `AGENTS.md`.

## M2 Domena

Cel: wszystkie reguły pieniężne jako czyste funkcje, zanim powstanie UI,
który z nich korzysta. Równolegle z T2–T4.

### T5 Kwoty, procenty, kurs: parsowanie, formatowanie, walidacja

- **Rezultat:** funkcje w `src/domain/` dla wszystkich pól z SPEC 7.1
  (parsowanie wejścia do liczb całkowitych, komunikaty błędów, walidacja
  nazw) i formatów z SPEC 8 (`1 960,00 zł`, `220,50 €`, postęp bez groszy).
- **Zależy od:** T1. **Poziom:** 2 (podstawa obliczeń).
- **Kryteria akceptacji:** każdy wiersz SPEC 7.1 ma testy przypadku
  poprawnego i każdego komunikatu; `1 234,56` i `1234.56` dają ten sam
  wynik; brak arytmetyki zmiennoprzecinkowej przy parsowaniu.
- **Weryfikacja:** testy jednostkowe, niezależne review.

### T6 Obliczenia planu, przeliczenia, postęp, czas

- **Rezultat:** funkcje: plan miesiąca z przychodów i migawki (SPEC 6.1–6.5),
  przeliczenia PLN↔EUR i majątek (6.7–6.8), postęp celu i „osiągnięty”
  (5.3, 6.6, 6.9), walidacja planu podziału z komunikatami (7.1: suma pul,
  suma celów, pula > 0% bez celów), bieżący miesiąc, ostatni dzień miesiąca
  i dozwolony poprzedni miesiąc w Europe/Warsaw (5.4, 5.5). Źródło
  bieżącego czasu dla aplikacji z podmianą zegara dla E2E wg STACK 5.
- **Zależy od:** T5. **Poziom:** 2 (podmiana zegara: bezpieczeństwo).
- **Kryteria akceptacji:** testy odtwarzają liczby ze scen. 1, 2, 3
  (komunikat „brakuje 10%”), 6, 11, 14, 17 i oba przykłady z SPEC 6;
  testy granic czasu: 31.10 23:59 i 1.11 00:00 czasu warszawskiego, zmiana
  czasu letniego, grudzień → styczeń; podmiana zegara działa przy jawnej
  fladze testowej, a test potwierdza, że przy ustawionym `VERCEL_ENV`
  flaga jest ignorowana.
- **Weryfikacja:** testy jednostkowe, niezależne review zgodności ze SPEC 6.

## M3 Konfiguracja

### T7a Layout, nawigacja i motywy

- **Rezultat:** wspólny układ wariantu B: górna nawigacja z pięcioma
  zakładkami (aktywna jako pigułka), kolumna do 1120 px, tokeny kolorów
  obu motywów z makiet, fonty Sora i DM Sans, przełącznik motywu
  w nagłówku, motyw w ciasteczku wg STACK 5, wskaźnik ładowania, komponent
  komunikatu błędu zapisu z SPEC 7.
- **Zależy od:** T1. **Poziom:** 1 (bez logiki; zmiany wizualne
  sprawdzane zrzutami ekranu w obu motywach).
- **Równolegle:** z T2–T6.
- **Kryteria akceptacji:** brak mignięcia motywu po przeładowaniu; przycisk
  w nagłówku ustawia motyw przeciwny do widocznego; nawigacja używalna
  przy 360 px bez przewijania w poziomie; kontrast tekstu ≥ 4.5:1 w obu
  motywach.
- **Weryfikacja:** E2E motywu, zrzuty ekranu 360 px i desktop w obu motywach.

### T7 Ustawienia

- **Rezultat:** ekran Ustawienia: kurs EUR→PLN, wybór motywu (z opcją
  „systemowy”), wylogowanie.
- **Zależy od:** T3, T5, T7a. **Poziom:** 2.
- **Kryteria akceptacji:** walidacja kursu z SPEC 7.1; zmiana kursu nie
  zmienia zapisanych wartości EUR; powrót do „systemowy” działa; przy
  wymuszonym błędzie zapisu formularz pokazuje komunikat z SPEC 7
  i zachowuje wpisaną wartość.
- **Weryfikacja:** E2E, niezależne review.

### T8 Majątek (źródła)

- **Rezultat:** ekran Majątek wg SPEC 5.2: lista, dodawanie, edycja,
  archiwizacja, sumy (całość, oszczędności, inwestycje), wartości EUR
  z przeliczeniem, prośba o kurs przy braku kursu.
- **Zależy od:** T6, T7. **Poziom:** 2 (dane).
- **Kryteria akceptacji:** scen. 9; scen. 16 w części dotyczącej Majątku
  (blokada archiwizacji przy wartości > 0 i przy połączeniu z celem
  bieżącego planu lub nierozliczonego miesiąca); blokada zmiany typu
  i waluty wg SPEC 5.2; zarchiwizowane źródło znika z sum i list wyboru.
- **Weryfikacja:** testy integracyjne reguł archiwizacji, E2E, niezależne
  review.

### T9 Plan podziału

- **Rezultat:** ekran Plan podziału wg makiety B3 i SPEC 5.3: procenty pul,
  cele z procentem, źródłem tego samego typu, kwotą docelową i startową,
  usuwaniem (miękkim); komunikaty walidacji na żywo. Cele są wyświetlane
  w kolejności dodania; zmiany kolejności nie ma (SPEC i makieta B3 jej
  nie przewidują).
- **Zależy od:** T8. **Poziom:** 2 (dane, złożony stan formularza).
- **Kryteria akceptacji:** scen. 3; wszystkie blokady z SPEC 7 dla planu;
  blokada zmiany źródła celu na inną walutę wg SPEC 6.9; zapis planu jest
  atomowy (pule i cele razem albo nic).
- **Weryfikacja:** testy integracyjne zapisu, E2E, niezależne review.

## M4 Ten miesiąc

### T10 Przychody i tworzenie miesięcy

- **Rezultat:** dodawanie, edycja i usuwanie pozycji przychodu; miesiąc
  powstaje przy pierwszym przychodzie z migawką bieżącego planu (SPEC 5.3,
  5.4, Z2); utworzenie poprzedniego miesiąca; edycja przychodów każdego
  nierozliczonego miesiąca; blokada edycji rozliczonego.
- **Zależy od:** T9. **Poziom:** 2 (dane, stan).
- **Kryteria akceptacji:** scen. 8, 18; utworzenie sierpnia w październiku
  jest odrzucone; dwa równoległe pierwsze przychody nie tworzą dwóch
  miesięcy; usunięcie ostatniej pozycji przychodu nierozliczonego miesiąca
  usuwa miesiąc z migawką (SPEC 7, P7): wraca pusty stan, znika pigułka,
  a ponowny przychód tworzy miesiąc z bieżącym planem.
- **Weryfikacja:** testy integracyjne, E2E, niezależne review.

### T11 Ekran „Ten miesiąc”

- **Rezultat:** ekran główny wg makiety B1 i SPEC 5.4 oraz 8: nagłówek
  z przychodami (rozwijana lista), zdanie „odkładasz X…”, pasek podziału
  z legendą, karty przelewów z postępem i „osiągnięty”, druga linia EUR
  albo link „Ustaw kurs EUR”, pusty stan, widok rozliczonego miesiąca,
  pasek majątku z liczbą źródeł.
- **Zależy od:** T10. **Poziom:** 2.
- **Kryteria akceptacji:** scen. 1, 10, 14 i scen. 16 (liczba źródeł)
  na ekranie; pusty stan z tekstem z SPEC 5.4; przy źródle EUR i braku
  kursu pasek majątku prosi o kurs zamiast sumy (SPEC 7); 360 px bez przewijania
  w poziomie w obu motywach.
- **Weryfikacja:** E2E, zrzuty ekranu porównane z makietą B1,
  niezależne review.

## M5 Rozliczenie i historia

### T12 Rozliczenie miesiąca

- **Rezultat:** ekran rozliczenia wg makiety B2 i SPEC 5.5: dwie opcje,
  pola faktycznych kwot, kwoty EUR z kursu, transakcja wg STACK 5,
  dostępność od ostatniego dnia miesiąca, komunikat o ponownym rozliczeniu.
- **Zależy od:** T11. **Poziom:** 2 (dane, współbieżność).
- **Kryteria akceptacji:** scen. 4, 5, 6, 11 (postęp po rozliczeniu), 15;
  brak kursu blokuje zatwierdzenie przy celu EUR; test integracyjny dwóch
  równoległych rozliczeń; przed ostatnim dniem miesiąca rozliczenie jest
  niedostępne.
- **Weryfikacja:** testy integracyjne współbieżności, E2E, niezależne
  review danych i współbieżności.

### T13 Zaległe miesiące

- **Rezultat:** pigułki „<Miesiąc> czeka na rozliczenie” z linkiem
  „Rozlicz”, od najstarszego, nad nagłówkiem „Ten miesiąc”.
- **Zależy od:** T12. **Poziom:** 1. **Równolegle:** z T14.
- **Kryteria akceptacji:** scen. 7; kilka zaległości widocznych naraz
  w dobrej kolejności; zaległość znika po rozliczeniu.
- **Weryfikacja:** E2E.

### T14 Historia

- **Rezultat:** ekran Historia wg SPEC 5.6: miesiące z przychodem,
  planem i wykonaniem dla pul i celów, statusem, wykonaniem EUR w EUR i PLN
  po kursie z rozliczenia; wejście do edycji przychodów nierozliczonego
  miesiąca.
- **Zależy od:** T12. **Poziom:** 2. **Równolegle:** z T13.
- **Kryteria akceptacji:** scen. 5 (plan 980,00 / wykonanie 500,00),
  scen. 8 (historia niezmieniona po zmianie planu); zmiana kursu nie
  zmienia historii; nazwa celu po edycji wyświetla się po nowemu także
  w starszych miesiącach.
- **Weryfikacja:** E2E, niezależne review.

## M6 Wydanie

### T15 Zamknięcie MVP

- **Rezultat:** wydanie zgodne z WORKFLOW etap G.
- **Zależy od:** wszystkie. **Poziom:** 3.
- **Kryteria akceptacji:** wszystkie 18 scenariuszy z SPEC 12 mają
  zielony test (STACK 7) lub odhaczony krok ręczny; scen. 12 sprawdzony
  na każdym ekranie; niezależne review zgodności ze SPEC i audyt
  bezpieczeństwa (dane finansowe w internecie); smoke test produkcji
  i próbna kopia `db:dump`; backlog SPEC 9 zapisany jako Issues.
- **Weryfikacja:** pełna bramka, ręczny scenariusz akceptacyjny
  właściciela produktu na produkcji.

## Pytania do review

Rzeczy, których specyfikacja nie rozstrzyga wprost. Reviewer etapu E ocenia,
czy to decyzje produktowe dla człowieka:

1. **Usunięcie ostatniej pozycji przychodu.** SPEC 5.4 mówi, że miesiąc
   powstaje przy pierwszym przychodzie, a SPEC 7, że miesiąc bez przychodu
   nie powstaje. Nie mówi, co się dzieje po usunięciu wszystkich pozycji
   istniejącego miesiąca. Propozycja: miesiąc znika (wraca pusty stan), bo
   tak zachowuje się miesiąc, który nigdy nie miał przychodu.
   **Rozstrzygnięte 2026-10-20 (SPEC P7):** właściciel wybrał „miesiąc
   znika”; SPEC 7 poprawiony.
