# BuildYourWealth: plan wykonania

Status: **MVP zatwierdzone po review etapu E (2026-10-20)**; zmiana koncepcji
wdrożenia z 2026-10-21 (SPEC P8, STACK 9.4): nowe zadania T4a i T16,
zmienione T4 (opis historyczny) i T15. MVP zamknięte (T15).
**Etap 2** (T17–T26, rozdział „Etap 2” na końcu): z 2026-10-27, po
review etapów B i E i rozstrzygnięciach właściciela.
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
| M1 Szkielet | Pusta aplikacja z logowaniem działa lokalnie jako wersja prywatna, Vercel przyjmuje tylko tryb demo, CI pilnuje jakości. | T1–T4, T4a |
| M2 Domena | Wszystkie reguły obliczeń i walidacji z SPEC 6–7 jako przetestowane funkcje. | T5–T6 |
| M3 Konfiguracja | Można ustawić kurs, motyw, źródła i plan podziału. | T7–T9 |
| M4 Ten miesiąc | Po wpisaniu przychodów widać plan przelewów (cel 1 ze SPEC 3). | T10–T11 |
| M5 Rozliczenie i historia | Rozliczenie dopisuje wpłaty do majątku, historia je pokazuje (cele 2–3 ze SPEC 3). MVP kompletne. | T12–T14 |
| M6 Demo i wydanie | Publiczne demo z piaskownicami; pełna weryfikacja poziomu 3 wersji prywatnej i demo. | T16, T15 |

Graf zależności:

```
T1 ─┬─ T2 ─ T3 ─ T4 ─ T4a (M1)
    ├─ T5 ─ T6 (M2)            ← równolegle z T2–T4
    └─ T7a (layout, motywy)    ← równolegle z T2–T4

T3 + T5 + T7a ─ T7 ─ T8 ─ T9 (M3)      ← T8 wymaga też T6
T9 ─ T10 ─ T11 (M4)
T11 ─ T12 ─ T13, T14 (M5)      ← T13 i T14 równolegle
T4a + T13 + T14 ─ T16 (M6)
wszystko ─ T15 (M6)

T4a jest pilne: do jego merge'u nie wprowadzamy prawdziwych danych
do żadnej bazy.
```

## M1 Szkielet

Cel: najwcześniej zredukować największe ryzyko z STACK 8 (integracja
Vercel + Neon + migracje + logowanie) i ustalić, że prawdziwe dane żyją
tylko w wersji prywatnej.

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

> **Zrealizowane** (PR #25) według koncepcji sprzed 2026-10-21. Po zmianie
> koncepcji Vercel i Neon hostują tylko demo; konto właściciela w Neon
> i procedura kopii z bazy Neon przestają obowiązywać (T4a). Opis niżej
> zostaje jako zapis tego, co powstało.

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

### T4a Tryby aplikacji i wersja prywatna

- **Rezultat:** moduł trybu `APP_MODE` (`private` / `demo`) wg STACK 5
  „Tryby aplikacji”: blokada trybu innego niż demo na Vercel (build
  i serwer), w trybie demo brak formularza logowania i odrzucanie logowania
  hasłem po stronie serwera; ekran startowy demo na razie tylko z opisem
  aplikacji i informacją, że demo jest w przygotowaniu (przycisk dodaje
  T16). Wersja prywatna wg STACK 5 „Wersja prywatna”: baza `byw_private`
  tworzona przez `compose.yaml`, porty tylko na `127.0.0.1`, plik
  `.env.private` z `.env.private.example`, skrypty `private:start`,
  `private:set-password`, `private:dump`. Kolumny `demo_expires_at`
  i `demo_ip_hash` w `users` (migracja dodająca, używa ich T16).
  Aktualizacja `AGENTS.md` (uruchomienie wersji prywatnej, kopia, smoke test
  demo zamiast produkcji).
- **Zależy od:** T4. **Poziom:** 2 (bezpieczeństwo, dane).
- **Wymaga człowieka:** usunięcie konta właściciela z bazy Neon (agent
  podaje polecenie), dodanie `APP_MODE=demo` w Vercel (zakres Production),
  utworzenie konta w wersji prywatnej skryptem (hasło nie przechodzi przez
  agenta), ponowne utworzenie wolumenu Dockera albo ręczne utworzenie bazy
  `byw_private`, jeśli wolumen już istnieje.
- **Kryteria akceptacji:** scen. 21 w części dotyczącej logowania i dostępu
  z sieci; build z `VERCEL_ENV` i bez `APP_MODE=demo` kończy się błędem
  (test); `private:start` na czystej bazie stosuje migracje i startuje na
  `127.0.0.1:4000`; `private:dump` tworzy kopię `byw_private`; żaden skrypt
  poza `private:*` nie czyta `.env.private` (test); po wdrożeniu
  na Vercel strona startowa demo nie ma formularza logowania.
- **Weryfikacja:** testy jednostkowe modułu trybu, E2E logowania w obu
  trybach, ręczna próba połączenia z innego urządzenia w sieci, niezależne
  review bezpieczeństwa.

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

## M6 Demo i wydanie

### T16 Wersja demo z piaskownicami

- **Rezultat:** wg SPEC 5.8 i STACK 5 „Piaskownice demo”: generator danych
  przykładowych (czysta funkcja z wstrzykniętym `now` i losowością, zapis
  przez `db/`), przycisk „Wypróbuj wersję demo” tworzący piaskownicę
  z sesją, baner demo, wygaśnięcie po 24 h, leniwe sprzątanie, limity
  z komunikatami, sekret `DEMO_IP_SECRET`, skrypt `demo:seed` dla `byw_dev`,
  projekt Playwright w trybie demo.
- **Zależy od:** T4a, T13, T14 (demo pokazuje wszystkie ekrany).
  **Poziom:** 2 (bezpieczeństwo, dane).
- **Wymaga człowieka:** dodanie `DEMO_IP_SECRET` w Vercel (agent podaje,
  jak wygenerować wartość).
- **Kryteria akceptacji:** scen. 19, 20, 21 (część demo); testy generatora:
  dla wielu ziaren losowości i dat `now` (1. i ostatni dzień miesiąca,
  przełom roku, zmiana czasu) dane przechodzą walidację planu z SPEC 7.1,
  ograniczenia bazy i spełniają reguły SPEC 6 (wartości źródeł = początek +
  rozliczone wpłaty, postęp celów); zawartość danych zgodna z listą SPEC 5.8;
  test limitów (11. wejście z jednego IP w godzinie odrzucone, 501. aktywna
  piaskownica odrzucona); w bazie nie ma jawnego adresu IP; piaskownica
  po wygaśnięciu nie ma ważnej sesji, a jej dane znikają przy kolejnym
  wejściu.
- **Weryfikacja:** testy jednostkowe generatora, testy integracyjne limitów
  i sprzątania, E2E w trybie demo, smoke test na `*.vercel.app`, niezależne
  review bezpieczeństwa.

### T15 Zamknięcie MVP

> **W toku.** Część autonomiczna (bramka w CI, pokrycie 21 scenariuszy,
> audyt niezmienników bezpieczeństwa, backlog SPEC 9 jako Issues #55–#65)
> zebrana w [`docs/RELEASE-MVP.md`](docs/RELEASE-MVP.md). Pozostają kroki
> ręczne właściciela (scenariusz akceptacyjny wersji prywatnej, przegląd demo
> na Vercel, próbna kopia `private:dump` + `pg_restore`) — lista w tym dokumencie.

- **Rezultat:** wydanie zgodne z WORKFLOW etap G.
- **Zależy od:** wszystkie. **Poziom:** 3.
- **Kryteria akceptacji:** wszystkie 21 scenariuszy z SPEC 12 mają
  zielony test (STACK 7) lub odhaczony krok ręczny; scen. 12 sprawdzony
  na każdym ekranie; niezależne review zgodności ze SPEC i audyt
  bezpieczeństwa (wersja prywatna niedostępna z sieci, demo bez dostępu do
  danych prywatnych, izolacja piaskownic, publiczne demo odporne na
  nadużycia); smoke test demo na Vercel i wersji prywatnej lokalnie;
  próbna kopia `private:dump` odtworzona przez `pg_restore` do pustej bazy;
  backlog SPEC 9 zapisany jako Issues.
- **Weryfikacja:** pełna bramka, ręczny scenariusz akceptacyjny
  właściciela produktu na wersji prywatnej, przegląd demo przez właściciela.

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

# Etap 2

Zakres: SPEC 5.9–5.12 i 8.1, reguły 6.10–6.13, scenariusze 22–39, STACK
„Kurs NBP”, „Historia wartości”, „Prognoza celu”, „Powiadomienia”.
Oznaczenia jak w MVP. Plan po niezależnym review etapu E
([`docs/reviews/plan-review-etap2-E.md`](docs/reviews/plan-review-etap2-E.md))
i rozstrzygnięciach właściciela z 2026-10-27.

**R** to odświeżenie wyglądu w kierunku „Portfel” (gałąź
`feat-portfel-reskin`, realizowane osobno). R dostaje własne Issue
(zakładane razem z T17–T26); kryterium „gotowe” to merge do `main`
z aktualizacją SPEC 8 (SPEC P20). R zmienia wyłącznie pliki interfejsu
(`src/app/(app)/*`, `src/ui/*`), więc z R kolidują tylko zadania
z interfejsem: T19b, T20, T22, T25. Zadania bez interfejsu idą od razu.

## Milestone'y Etapu 2

| Milestone | Działający przyrost | Zadania |
| --- | --- | --- |
| M7 Fundamenty | Aplikacja zapisuje historię wartości, ma kursy NBP i termin celu w bazie oraz obliczenia prognozy. | T17, T18, T21 |
| M8 Kurs NBP | Rozliczenie po kursie z końca miesiąca; kurs EUR bez ręcznego wpisywania na wszystkich ekranach. | T19a, T19b |
| M9 Wykres i prognoza | Wykres majątku na Majątku; termin, prognoza i sugestia procentu przy celach. | T20, T22 |
| M10 Powiadomienia | Wersja prywatna wysyła maile o przychodach, rozliczeniu i celach; demo pokazuje podgląd. | T23a, T23b, T24, T25 |
| M11 Wydanie Etapu 2 | Pełna weryfikacja poziomu 3. | T26 |

Graf zależności:

```
Bez R (od razu, równolegle):
T17 (historia wartości)
T18 (kursy NBP) ─ T19a (kurs w rozliczeniu, dane)
T21 (termin: dane + domena prognozy) ─ T23a (wybór i treści maili) ─ T23b (wysyłka)
T23b + T19a ─ T24 (wyzwalacze, Harmonogram)

Po R:
T19a ─ T19b (kurs na ekranach) ─ T20 (wykres; wymaga też T17)
T21 + T18 ─ T22 (termin i prognoza w interfejsie)
T23b ─ T25 (Ustawienia, podgląd demo)

wszystko ─ T26
```

T17 jest pilne: historia wartości liczy się od wdrożenia (SPEC P17), więc
każdy tydzień zwłoki to tydzień bez danych na wykresie. Po jego merge'u
właściciel aktualizuje wersję prywatną: `git pull`, **`npm run private:dump`**
(pierwsza migracja z danymi na `byw_private`), potem `npm run private:start`.

T19a i T24 zmieniają akcję rozliczenia, więc nie idą równolegle (T24 po
T19a). T19b i T20 zmieniają `majatek/page.tsx`, więc T20 idzie po T19b.

## M7 Fundamenty

### T17 Historia wartości źródeł

- **Rezultat:** tabela `source_values` (z walutą) z migracją wstawiającą
  punkt `initial` dla wszystkich źródeł; jedna funkcja w `db/` dla każdej
  zmiany wartości źródła (dodanie, edycja, rozliczenie, archiwizacja),
  zapisująca historię w tej samej transakcji; generator demo z datami
  rozliczeń z pierwszych dni następnego miesiąca i 12 miesiącami historii
  zgodnej z rozliczeniami, z co najmniej jedną ręczną zmianą wyceny
  (SPEC 5.8); instrukcja aktualizacji wersji prywatnej z `private:dump`
  w `AGENTS.md`.
- **Zależy od:** brak. **Poziom:** 2 (dane, migracja na `byw_private`).
  **Równolegle:** z T18, T21.
- **Kryteria akceptacji:** migracja na bazie z danymi MVP zachowuje
  wszystkie wartości i tworzy po jednym punkcie `initial` na źródło (także
  zarchiwizowane); `drizzle-kit generate` po migracji nie daje różnicy;
  test integracyjny każdej ścieżki zmiany wartości widzi nowy wiersz
  z właściwym powodem i walutą; odrzucone drugie rozliczenie (scen. 15) nie
  zostawia wpisu; w kodzie nie ma innego zapisu `sources.value`; testy
  generatora: ostatni punkt historii każdego źródła = jego bieżąca wartość,
  daty rozliczeń po końcu rozliczanego miesiąca i przed `now`.
- **Weryfikacja:** testy integracyjne, niezależne review migracji.

### T18 Kursy NBP: pobieranie i wybór kursu

- **Rezultat:** wg STACK „Kurs NBP”: tabele `exchange_rates`
  i `rate_fetches` (jeden wiersz na walutę), klient NBP z limitem czasu,
  leniwe pobieranie brakujących zakresów (raz na godzinę, 404 jako „brak
  tabel”, podział na zakresy ≤ 93 dni), czyste funkcje reguły 6.10 (bieżący
  kurs, kurs na dzień, kurs rozliczenia, kurs zapasowy), helper E2E
  wstawiający kursy i obsługa `NBP_API_URL` (ignorowana przy `VERCEL_ENV`).
- **Zależy od:** brak. **Poziom:** 2 (integracja zewnętrzna).
  **Równolegle:** z T17, T21.
- **Kryteria akceptacji:** testy jednostkowe reguły 6.10: weekend na końcu
  miesiąca (31.10.2026 to sobota → tabela z 30.10), rozliczenie ostatniego
  dnia przed publikacją tabeli (scen. 35), okno D − 6 … D, brak tabel
  w oknie → kurs zapasowy, brak obu → brak kursu; test integracyjny: brak
  odpowiedzi NBP nie rzuca błędu i zwraca kurs z bazy, druga próba w ciągu
  godziny nie łączy się z NBP, 404 nie jest błędem, zakres dłuższy niż
  93 dni dzielony na zapytania; żaden test nie łączy się z prawdziwym NBP.
- **Weryfikacja:** testy jednostkowe i integracyjne, niezależne review.

### T21 Termin celu: dane i domena prognozy

- **Rezultat:** kolumna `goals.deadline` (migracja, CHECK „termin tylko
  z kwotą docelową”, zapis i odczyt w `db/`, usunięcie kwoty docelowej
  usuwa termin na poziomie `db/`); czyste funkcje reguł 6.12–6.13: średnia
  wpłata (faktyczna albo z planu), pierwszy miesiąc wpłaty, miesiąc
  osiągnięcia, statusy (w tym „brak danych”), `zaplanowane`, k, wymagana
  wpłata, sugerowany procent i komunikaty zamiast sugestii; walidacja
  terminu z SPEC 7.1.
- **Zależy od:** brak. **Poziom:** 2 (obliczenia, dane).
  **Równolegle:** z T17, T18.
- **Kryteria akceptacji:** przykład prognozy z SPEC 6 co do grosza
  (566,66 zł, styczeń 2027, 712,00 zł, 36,33%, 178,00 zł) i scen. 38
  (428,58 zł); przypadki: mniej niż 3 rozliczone miesiące, brak rozliczeń
  („planujesz”), brak danych, średnia 0, termin minął, termin = P, k = 0,
  `zaplanowane` ≥ `pozostało`, cel EUR (kwoty w EUR, procent z PLN, brak
  kursu), sugestia powyżej 100%, rozliczenia nie po kolei, przełom roku.
- **Weryfikacja:** testy jednostkowe i integracyjne zapisu terminu,
  niezależne review obliczeń.

## M8 Kurs NBP

### T19a Kurs NBP w rozliczeniu (dane)

- **Rezultat:** kolumny `months.settled_rate_date`
  i `settled_rate_source` z migracją (`manual` tylko dla miesięcy
  z `settled_eur_rate`, CHECK spójności); rozliczenie ustala kurs przed
  transakcją wg reguły 6.10, tylko gdy miesiąc ma cel EUR; akcja odrzuca
  zapis, gdy kurs różni się od pokazanego (scen. 36); kurs zapasowy
  w `settings`; generator demo zapisuje kursy rozliczeń jako `fallback`.
  Bez zmian w plikach R; ekran rozliczenia dostaje tylko konieczne pola
  formularza (data i pochodzenie kursu).
- **Zależy od:** T18. **Poziom:** 2 (pieniądze, rozliczenie, migracja).
- **Kryteria akceptacji:** test migracji na danych MVP z miesiącem z celem
  EUR i bez; scen. 23, 24, 35, 36 jako testy integracyjne akcji; scen. 6
  i 15 nadal przechodzą; pobieranie z NBP nie dzieje się w transakcji;
  rozliczenie bez celu EUR przechodzi bez żadnego kursu.
- **Weryfikacja:** testy integracyjne, niezależne review.

### T19b Kurs NBP na ekranach

- **Rezultat:** SPEC 5.9 i zmiany w 5.2, 5.4–5.7: Ustawienia z kursem NBP
  i datą, ostrzeżeniem o starym kursie i polem kursu zapasowego; Majątek
  i „Ten miesiąc” na bieżącym kursie z datą; ekran rozliczenia z kursem
  rozliczenia, prośbą o kurs zapasowy i komunikatem o zmianie kursu;
  Historia z pochodzeniem kursu (także „ręczny, sprzed Etapu 2”).
- **Zależy od:** T19a, R. **Poziom:** 2.
- **Kryteria akceptacji:** scen. 22, 23, 24, 35, 36, 39 jako E2E; scen. 12
  dla zmienionych ekranów; nowe akcje mają test „bez sesji brak danych”
  (scen. 13).
- **Weryfikacja:** E2E z kursami z helpera, niezależne review.

## M9 Wykres i prognoza

### T20 Wykres wartości majątku

- **Rezultat:** SPEC 5.11 i 8.1: czysta funkcja reguły 6.11 (punkty na
  koniec miesiąca, waluta z zapisu historii, EUR po kursie z końca
  miesiąca), komponent SVG na Majątku z podpowiedziami na hover, dotyk
  i fokus, tabela dla czytników ekranu, pusty stan, prośba o kurs.
- **Zależy od:** T17, T19b, R. **Poziom:** 2.
- **Kryteria akceptacji:** scen. 25, 26; wykres w demo pokazuje 12 miesięcy
  (scen. 34, część), a pierwsze wejście do demo pobiera brakujące kursy
  końców miesięcy kilkoma zapytaniami; scen. 12 dla Majątku (oba motywy,
  360 px bez przewijania w poziomie); brak nowej zależności produkcyjnej.
- **Weryfikacja:** testy jednostkowe reguły 6.11 (przełom roku, źródło
  dodane w trakcie miesiąca, archiwizacja, zmiana waluty, brak kursu
  z końca miesiąca), E2E.

### T22 Termin celu i prognoza w interfejsie

- **Rezultat:** SPEC 5.12 i 8.1: pole terminu w Planie podziału, linia
  prognozy i statusu na „Ten miesiąc” (z dopiskiem o nowym procencie),
  wymagana wpłata i sugestia albo komunikat w Planie podziału, link
  z „zagrożony”; generator demo z celem „zdążysz” i „zagrożony”.
- **Zależy od:** T21, T18, R. **Poziom:** 2.
- **Kryteria akceptacji:** scen. 27, 28, 37, 38; walidacja terminu z SPEC
  7.1; procenty planu nie zmieniają się same; testy generatora potwierdzają
  oba statusy dla wielu dat `now`; scen. 12 dla Planu podziału i „Ten
  miesiąc”.
- **Weryfikacja:** E2E, testy generatora.

## M10 Powiadomienia

### T23a Wybór maili i treści

- **Rezultat:** czysta funkcja wyboru maili dla trzech grup wg tabeli
  „Kiedy / Aktualny” z SPEC 5.10 (w tym nowy miesiąc do rozliczenia, 7 dni
  kalendarzowych od `sent_at`, okno 30 dni, status „zagrożony” i jego
  zerowanie), klucze deduplikacji, polskie tematy z odmianą liczby
  miesięcy i treści jako zwykły tekst; kolumny `settings.notify_*`
  i `goals.risk_notified_at`.
- **Zależy od:** T21. **Poziom:** 2.
- **Kryteria akceptacji:** scen. 29–32 jako testy z wstrzykniętym `now`
  (w tym 30.11 w scen. 30, 1.10 → 5.11 w scen. 31, marzec → grudzień bez
  sprawdzenia w scen. 32); scen. 33 część „grupa włączona 15.11”;
  wyłączona grupa nie daje maili; podgląd demo z danych generatora zawiera
  maile ze scen. 34.
- **Weryfikacja:** testy jednostkowe, niezależne review.

### T23b Wysyłka i deduplikacja

- **Rezultat:** wg STACK „Powiadomienia”: tabela `notifications` (jeden
  wiersz na mail), przejęcie wiersza i ponowienia, wysyłka przez
  `nodemailer` ze wstrzykiwanym transportem i wymogiem TLS dla hosta innego
  niż `localhost`, krótkie limity czasu, funkcja „sprawdź i wyślij”, moduł
  wysyłki odmawiający działania w trybie demo, atrapa SMTP na `node:net`
  z trybem „odrzuć AUTH” podłączona w `playwright.config.ts`.
- **Zależy od:** T23a. **Poziom:** 2 (nowa zależność produkcyjna, dane
  wychodzące poza komputer).
- **Kryteria akceptacji:** dwa równoległe sprawdzenia z różnych połączeń
  wysyłają mail raz; proces przerwany po przejęciu nie blokuje maila na
  stałe; błąd transportu zostawia mail do ponowienia, a wiersz pokazuje
  błąd; brak zmiennych `SMTP_*` = brak wysyłki bez błędu; tryb demo nie
  tworzy transportu SMTP; uzasadnienie `nodemailer` w PR (STACK 2).
- **Weryfikacja:** testy integracyjne, niezależne review bezpieczeństwa
  (co wychodzi poza komputer, sekrety, TLS, demo).

### T24 Wyzwalacze w wersji prywatnej

- **Rezultat:** `npm run private:notify` (czeka na Dockera do 5 minut, nie
  migruje, log w `logs/`, `/logs/` w `.gitignore`), sprawdzenie
  w `private:start` równolegle ze startem serwera, sprawdzenie po
  rozliczeniu i zapisie planu lub celu przez `after()` tylko po udanym
  zapisie, `private:notify:install` / `:uninstall` (wyzwalacz codzienny
  i przy logowaniu z opóźnieniem, `StartWhenAvailable`, katalog roboczy,
  pełna ścieżka do `node`, ukryte okno), przekazanie `SMTP_*` i czyszczenie
  `NBP_API_URL` w `scripts/private-env.ts`, `SMTP_*`
  w `.env.private.example`, instrukcja w `AGENTS.md` (hasło aplikacji
  Gmail, rejestracja zadania, autostart Docker Desktop — SPEC P21).
- **Zależy od:** T23b, T19a. **Poziom:** 2.
- **Wymaga człowieka:** hasło aplikacji Gmail i zmienne `SMTP_*`
  w `.env.private`, włączenie autostartu Docker Desktop, rejestracja
  zadania, sprawdzenie maila na prawdziwej skrzynce (agent nie czyta
  `.env.private`).
- **Kryteria akceptacji:** `private:notify` na `byw_dev` z atrapą SMTP
  wysyła mail ze scen. 29; Docker niedostępny przez 5 minut daje czytelny
  błąd i kod ≠ 0; oczekujące migracje dają błąd „uruchom private:start”;
  test `private-env` (przekazanie `SMTP_*`, brak `NBP_API_URL`);
  rozliczenie nie czeka na SMTP; skrypty instalacji są idempotentne;
  ręczny test właściciela: wylogowanie, zalogowanie z wyłączonym Dockerem
  → mail wychodzi bez ręcznej akcji.
- **Weryfikacja:** testy skryptów, ręczny test właściciela.

### T25 Ustawienia powiadomień i podgląd w demo

- **Rezultat:** sekcja „Powiadomienia” w Ustawieniach (SPEC 5.10, 8.1):
  adres, przełączniki, „Wyślij testowy mail”, lista 10 ostatnich maili
  z ostatnim stanem, stan „nie skonfigurowano”; w demo wyłącznie podgląd
  maili.
- **Zależy od:** T23b, R. **Poziom:** 2.
- **Kryteria akceptacji:** scen. 33, 34 (część powiadomień) jako E2E
  z atrapą SMTP; walidacja adresu z SPEC 7.1; testowy mail w demo jest
  odrzucony po stronie serwera; nowe akcje mają test „bez sesji brak
  danych”; scen. 12 dla Ustawień.
- **Weryfikacja:** E2E w obu trybach, niezależne review.

## M11 Wydanie Etapu 2

### T26 Zamknięcie Etapu 2

- **Rezultat:** wydanie zgodne z WORKFLOW etap G, raport
  `docs/RELEASE-ETAP-2.md` (jak `RELEASE-MVP.md`).
- **Zależy od:** wszystkie. **Poziom:** 3.
- **Kryteria akceptacji:** scenariusze 1–39 mają zielony test albo
  odhaczony krok ręczny; audyt bezpieczeństwa: wersja prywatna nadal
  niedostępna z sieci, jedyne połączenia wychodzące to NBP i SMTP przez TLS,
  demo nie wysyła maili, kursy demo nie są podpisane jako NBP; smoke test
  demo; wersja prywatna zaktualizowana z kopią przed migracją
  (`private:dump`), testowy mail i mail z Harmonogramu odebrane przez
  właściciela.
- **Weryfikacja:** pełna bramka, ręczny scenariusz właściciela.

## Rozstrzygnięcia review Etapu 2

Właściciel produktu przyjął 2026-10-27 rekomendacje obu review:

- **Review B** (`docs/reviews/spec-review-etap2-B.md`): D1 → SPEC P22,
  D2 → P23, D3 → wyjątek w P10 i scen. 35; B1–B9 poprawione w SPEC.
- **Review E** (`docs/reviews/plan-review-etap2-E.md`): D1 → `nodemailer`
  z wymogiem TLS (STACK 9.5); D2 → Z10–Z16 zaakceptowane, kursy demo jako
  `fallback`; D3 → autostart Dockera (SPEC P21, STACK 9.8); D4 → podział
  T19 na T19a i T19b, Issue dla R; B1–B5 poprawione w PLAN i STACK.
