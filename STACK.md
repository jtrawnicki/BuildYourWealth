# BuildYourWealth: decyzje techniczne

Status: **zatwierdzony przez właściciela produktu (etap C, 2026-10-20)**,
łącznie z decyzjami z rozdz. 9; zmiana koncepcji wdrożenia (wersja prywatna
lokalnie, publiczne demo) z 2026-10-21, decyzja 9.4. Dokument opisuje trwałe decyzje techniczne dla MVP
z [`SPEC.md`](SPEC.md). Zakres i zachowanie produktu opisuje wyłącznie `SPEC.md`;
w razie konfliktu agent zgłasza go, zamiast wybierać wygodniejszą wersję.

## 1. Założenia wejściowe

Decyzje wynikają z ograniczeń specyfikacji:

- zero kosztów, akceptowane usypianie (SPEC 10);
- prawdziwe dane tylko na komputerze właściciela, aplikacja niedostępna
  z sieci; publicznie wyłącznie demo z danymi wygenerowanymi (SPEC 5.8, 10);
- jeden użytkownik, logowanie e-mail i hasło, brak rejestracji (SPEC 5.1);
- arytmetyka wyłącznie na liczbach całkowitych (SPEC 6);
- rozliczenie atomowe i jednorazowe (SPEC 5.5);
- czas w strefie Europe/Warsaw (SPEC 5.5);
- dwa motywy, polski interfejs, od 360 px (SPEC 8).

Repozytorium nie ma jeszcze kodu, więc nie ma istniejącego stosu do zachowania.

## 2. Stos

| Warstwa | Wybór | Dlaczego |
| --- | --- | --- |
| Język | TypeScript (strict) | Jeden język dla UI, serwera i testów. |
| Framework | Next.js (App Router, aktualna stabilna 16.x) z React | Renderowanie na serwerze i mutacje przez Server Actions bez osobnego API; natywny hosting na Vercel. |
| Baza danych | PostgreSQL | Transakcje i ograniczenia unikalności zapewniają atomowe rozliczenie. |
| Dostęp do bazy | Drizzle ORM + sterownik `pg` | Typowane zapytania, migracje jako pliki SQL w repozytorium, interaktywne transakcje. |
| Uruchomienie wersji prywatnej | `next start` na komputerze właściciela, nasłuch tylko na `127.0.0.1` | Dane nie opuszczają komputera; brak usługi, którą trzeba zabezpieczać w internecie. |
| Baza wersji prywatnej | PostgreSQL 17 w Dockerze (`compose.yaml`), osobna baza `byw_private` | Ten sam silnik co w testach i demo; port bazy też tylko na `127.0.0.1`. |
| Hosting demo | Vercel, plan Hobby (region `fra1`) | Darmowy, HTTPS i deploy z GitHub bez konfiguracji. |
| Baza demo | Neon, plan Free (region Frankfurt) | Darmowy, usypia po 5 min i budzi się przy połączeniu; nie wstrzymuje projektu za brak aktywności. Trzyma wyłącznie dane wygenerowane. |
| Style | CSS Modules + zmienne CSS dla motywów | Bez dodatkowej biblioteki; kolory z makiet przenoszą się 1:1 jako tokeny. |
| Fonty | `next/font/google` (Sora, DM Sans) | Fonty serwowane z własnej domeny, bez zapytań do Google w przeglądarce. |
| Testy jednostkowe i integracyjne | Vitest | Szybkie, natywny TypeScript. |
| Testy E2E | Playwright | Scenariusze akceptacyjne z SPEC 12 w prawdziwej przeglądarce, także 360 px i oba motywy. |
| Jakość | ESLint (konfiguracja Next.js), Prettier, `tsc --noEmit` | Standard dla tego stosu. |
| CI | GitHub Actions | Bramka jakości przy każdym PR; Postgres jako kontener usługi. |

Zależności produkcyjne: `next`, `react`, `react-dom`, `drizzle-orm`, `pg`.
Wszystko inne to zależności deweloperskie. Każda nowa zależność produkcyjna
wymaga uzasadnienia w PR.

Świadomie nie używamy: biblioteki uwierzytelniania (Auth.js, Clerk), Tailwind,
biblioteki komponentów, biblioteki walidacji (Zod), biblioteki dat ani
biblioteki do pieniędzy. Każdą z tych potrzeb pokrywa kilkadziesiąt linii
własnego, w pełni przetestowanego kodu albo platforma (`node:crypto`, `Intl`).

### Odrzucone alternatywy

- **Supabase (baza i auth):** projekt na planie Free jest wstrzymywany po
  7 dniach niskiej aktywności i trzeba go ręcznie wznowić w panelu. Aplikacja
  używana głównie raz w miesiącu trafiałaby na to regularnie.
- **Cloudflare Workers + D1:** darmowe i bez usypiania, ale D1 nie ma
  interaktywnych transakcji, a ekosystem Next.js działa tam z ograniczeniami.
  Więcej nietypowych decyzji przy małym zysku.
- **Render / Fly.io z własnym serwerem:** darmowa baza Render wygasa po 30
  dniach, a stały serwer to więcej konfiguracji niż Vercel.

## 3. Architektura

Jedna aplikacja Next.js, bez osobnego backendu i bez publicznego API.

```
src/
  domain/      czyste funkcje: kwoty, procenty, plan, przeliczenia, walidacja
  db/          schemat Drizzle, połączenie, zapytania
  auth/        hasła, sesje, guard
  demo/        tryb aplikacji, generator danych demo, piaskownice
  app/         strony (Server Components) i Server Actions
  ui/          współdzielone komponenty i style
drizzle/       wygenerowane migracje SQL (commitowane)
scripts/       migracja, tworzenie konta, reset hasła, wersja prywatna
e2e/           testy Playwright
```

Zasady:

1. **Warstwa `domain` nie zna bazy ani Reacta.** Wszystkie reguły z SPEC 6
   i 7.1 żyją tutaj jako czyste funkcje i są testowane jednostkowo, w tym
   każdy przykład liczbowy ze specyfikacji.
2. **Odczyt:** Server Components czytają dane bezpośrednio przez `db/`.
3. **Zapis:** wyłącznie Server Actions. Każda akcja najpierw sprawdza sesję,
   potem waliduje dane funkcjami z `domain`, potem zapisuje.
4. **Plan miesiąca nie jest zapisywany.** Kwoty pul, celów i „do wydania” są
   wyliczane przy każdym odczycie z przychodów i migawki planu. Zapisywane są
   tylko dane wejściowe i faktyczne kwoty rozliczenia.
5. **Błędy zapisu** wracają do formularza jako komunikat z SPEC 7, a formularz
   zachowuje wpisane dane (formularze oparte na `useActionState`).

## 4. Model danych

Kwoty to `bigint` w jednostkach minimalnych (grosze lub eurocenty), procenty
to `integer` w setnych procenta (33,33% = 3333), kurs to `integer`
w dziesięciotysięcznych (4,2850 = 42850). W TypeScript te wartości są typu
`number`; zakres jest bezpieczny (do ok. 90 bilionów zł). Pojedyncza
kwota wpisywana przez użytkownika ma górną granicę 2 mld (zł lub €), a kurs
granicę kolumny `integer`, 214 748,3647 (ograniczenie techniczne zaakceptowane
przez właściciela 2026-10-21, ten sam komunikat co dla błędnego kursu).
Iloczyny pośrednie (kwota × procent, kwota × kurs) domena liczy na `BigInt`,
bo przy kursie powyżej ok. 4,5 iloczyn kwoty 2 mld przekracza
`Number.MAX_SAFE_INTEGER`; wynik po zaokrągleniu wraca jako `number`, a
funkcje domeny zgłaszają błąd, jeśli nie mieści się w bezpiecznym zakresie.

| Tabela | Kolumny (skrót) | Uwagi |
| --- | --- | --- |
| `users` | id, email, password_hash, demo_expires_at, demo_ip_hash | Wersja prywatna: jedno konto, `demo_*` puste. Demo: każde konto to piaskownica z czasem wygaśnięcia i skrótem adresu IP (do limitu, SPEC 5.8). |
| `sessions` | id (hash tokenu), user_id, expires_at | Token w ciasteczku, w bazie tylko hash. |
| `settings` | user_id, eur_rate (null = brak), savings_pct, investments_pct | Kurs i procenty pul bieżącego planu. |
| `sources` | id, user_id, name, kind, currency, value, note, archived_at | `kind`: savings / investments; `currency`: PLN / EUR. |
| `goals` | id, user_id, pool, name, pct, source_id, target_amount, start_amount, position, removed_at | Usunięcie z planu ustawia `removed_at`; tożsamość celu się nie zmienia. |
| `months` | id, user_id, month (`YYYY-MM`), savings_pct, investments_pct, settled_at, settled_eur_rate | Unikalne (user_id, month). Migawka procentów pul. |
| `month_goals` | month_id, goal_id, pool, pct, source_id, actual_amount | Migawka celów; `actual_amount` w walucie źródła, null do rozliczenia. |
| `incomes` | id, month_id, name, amount | Pozycje przychodu. |

Tabele mają `user_id`, bo dostęp i tak jest sprawdzany per użytkownik; nie
budujemy niczego więcej dla wielu kont (rejestracji, ról, zaproszeń).
Piaskownice demo korzystają z tej izolacji: każda to osobny użytkownik,
a usunięcie użytkownika kaskadowo usuwa jego dane (FK `ON DELETE CASCADE`).

Ograniczenia w bazie (CHECK, NOT NULL, FK) powtarzają reguły, które chronią
spójność danych: kwoty ≥ 0, procenty w zakresie, kurs > 0, unikalny miesiąc.
Reguły z komunikatami dla użytkownika sprawdza `domain`.

## 5. Kluczowe mechanizmy

### Rozliczenie (SPEC 5.5)

Jedna transakcja:

1. `UPDATE months SET settled_at = now(), settled_eur_rate = … WHERE id = … AND user_id = … AND settled_at IS NULL RETURNING id`.
   Brak zwróconego wiersza oznacza „Ten miesiąc jest już rozliczony” i
   wycofanie transakcji.
2. Zapis `actual_amount` w `month_goals`.
3. `UPDATE sources SET value = value + …` dla każdego połączonego źródła.

Warunkowy `UPDATE` serializuje równoległe próby (druga karta, podwójne
kliknięcie) bez blokad aplikacyjnych. Test integracyjny uruchamia dwa
równoległe rozliczenia i sprawdza, że wartości źródeł zmieniły się raz.

### Czas i miesiące

Bieżący miesiąc i „ostatni dzień miesiąca” są liczone przez `Intl.DateTimeFormat`
ze strefą `Europe/Warsaw`, w jednej funkcji domeny przyjmującej `now` jako
parametr. Aplikacja bierze `now` z jednego modułu zegara. Testy E2E działają
na buildzie produkcyjnym (`NODE_ENV=production`), więc podmiana zegara nie
może zależeć od `NODE_ENV`: włącza ją jawna flaga testowa, a moduł ignoruje
ją, gdy ustawiony jest `VERCEL_ENV` (każde środowisko Vercel).

### Logowanie i sesje

- Hasło: `scrypt` z `node:crypto`, losowa sól, porównanie w stałym czasie.
- Sesja: losowy token 32 bajty w ciasteczku `HttpOnly`, `Secure`,
  `SameSite=Lax`, ważność 30 dni; w bazie tylko jego hash SHA-256.
- Każda strona poza logowaniem i każda Server Action wywołuje jeden guard
  `requireUser()`. Test E2E sprawdza, że bez sesji strony przekierowują na
  logowanie, a akcje nie zwracają danych (SPEC 12, scenariusz 13).
- Ochrona przed zgadywaniem hasła: opóźnienie po nieudanej próbie i limit prób
  na konto zapisany w bazie.
- Konto i reset hasła: skrypt `npm run user:set-password -- <email>` uruchamiany
  ręcznie na bazie wersji prywatnej (SPEC, założenie Z1).
- W trybie demo logowanie hasłem jest wyłączone także po stronie serwera
  (akcja odrzuca każdą próbę), a sesja piaskownicy wygasa razem z nią
  (`expires_at` = `demo_expires_at`), nie po 30 dniach.

### Tryby aplikacji

Ten sam kod działa w dwóch trybach wybieranych zmienną `APP_MODE`:
`private` (domyślny) albo `demo`. Tryb czyta jeden moduł w `src/demo/`;
reszta kodu pyta go, zamiast czytać zmienną.

- **Blokada na Vercel:** gdy ustawione jest `VERCEL_ENV`, aplikacja wymaga
  `APP_MODE=demo`. Build (`vercel-build`) kończy się błędem, a serwer odmawia
  obsługi żądań przy innym trybie. Dzięki temu pomyłka w zmiennych nie
  wystawi do internetu trybu z logowaniem hasłem.
- **Tryb prywatny** nie ma wejścia do demo: akcja tworząca piaskownicę
  niczego nie zapisuje i nie zwraca danych.
- **Separacja danych wynika z architektury, nie z kodu:** Vercel zna tylko
  adres bazy Neon. Baza `byw_private` nie jest dostępna z sieci, więc żaden
  błąd w aplikacji demo nie sięgnie prawdziwych danych.

### Wersja prywatna

- Osobna baza `byw_private` w kontenerze z `compose.yaml` (obok `byw_dev`
  i `byw_test`). Adres w pliku `.env.private` (poza repozytorium), którego
  nie używają testy, `npm run dev` ani agenci.
- `npm run private:start`: ładuje `.env.private`, stosuje migracje, buduje
  aplikację i uruchamia `next start -H 127.0.0.1 -p 4000`. Adres:
  `http://127.0.0.1:4000`. Port inny niż `npm run dev` (3000) i E2E (3100),
  więc wersja prywatna może działać równolegle z pracą nad kodem.
- `npm run private:set-password -- <email>`: ten sam skrypt co
  `user:set-password`, z bazą z `.env.private`.
- `npm run private:dump`: `pg_dump` uruchamiany w kontenerze bazy, więc
  wersja klienta zawsze pasuje do serwera i na komputerze nie trzeba
  instalować klienta Postgres.
- `private:start` buduje do osobnego katalogu `.next-private`, więc build
  do testów (`.next`) nie podmienia plików działającej wersji prywatnej.
  Tworzy też bazę `byw_private`, jeśli wolumen Dockera powstał wcześniej.
- `compose.yaml` publikuje port Postgresa tylko na `127.0.0.1`.
- Ciasteczko `Secure` działa na `http://127.0.0.1`, bo przeglądarki traktują
  adres pętli zwrotnej jak bezpieczny kontekst (E2E już z tego korzysta).

### Piaskownice demo (SPEC 5.8)

- **Wejście:** Server Action w jednej transakcji: usuwa wygasłe piaskownice,
  sprawdza limity, tworzy użytkownika demo (e-mail z losowym identyfikatorem
  w domenie `.invalid`, losowy skrót hasła, którym nie da się zalogować),
  zapisuje dane z generatora i sesję. Limity liczy z `users`: piaskownice
  z tego samego `demo_ip_hash` w ostatniej godzinie i wszystkie aktywne.
- **Adres IP:** z nagłówka `x-forwarded-for` ustawianego przez Vercel;
  w bazie tylko jego HMAC-SHA-256 z sekretem `DEMO_IP_SECRET`, nigdy sam
  adres.
- **Sprzątanie:** leniwe, przy każdym wejściu do demo; bez crona
  i publicznego endpointu. Wygasła piaskownica i tak nie ma ważnej sesji,
  więc zalegające wiersze niczego nie ujawniają.
- **Generator** (`src/demo/`): czysta funkcja `(now, losowość) → dane`,
  która nie zna bazy, plus osobny zapis wyniku przez `db/`. Daty liczy
  względem `now` w Europe/Warsaw, kwoty planu i rozliczeń funkcjami z `domain`,
  wartości źródeł jako wartość początkowa + suma rozliczonych wpłat, więc
  dane spełniają wszystkie reguły SPEC 6 i ograniczenia bazy. Losowość
  wstrzykiwana, żeby testy były powtarzalne.
- `npm run demo:seed -- <email>` zapisuje dane z generatora dla istniejącego
  konta w `byw_dev` (ręczne oglądanie ekranów podczas pracy). Odmawia pracy
  na bazie `byw_private`.

### Motyw

Wybór motywu w ciasteczku (nie w `localStorage`). Skrypt w `<head>` czyta
ciasteczko i ustawia motyw przed pierwszym malowaniem, więc nie ma mignięcia,
a strony nadal mogą być prerenderowane (odczyt `cookies()` w root layoutcie
zablokowałby to przy Cache Components). Brak ciasteczka oznacza motyw
systemowy przez `prefers-color-scheme`.

### Usypianie

Dotyczy demo: baza Neon budzi się w czasie rzędu sekund. Strony pokazują
`loading.tsx` ze wskaźnikiem, a błąd połączenia przy zapisie daje komunikat
z SPEC 7. Wersja prywatna nie usypia.

## 6. Środowiska i wdrożenie

| Środowisko | Baza | Tryb | Uwagi |
| --- | --- | --- | --- |
| Deweloperskie | `byw_dev` w Dockerze (`docker compose up db`) | dowolny | `npm run dev`; dane testowe albo z `demo:seed`. |
| Sesja chmurowa agenta | Lokalny klaster Postgres w kontenerze | dowolny | Demon Dockera nie działa; hook SessionStart uruchamia klaster. |
| CI | Postgres jako kontener usługi GitHub Actions | oba | Świeża baza dla każdego uruchomienia. |
| Wersja prywatna | `byw_private` w Dockerze na komputerze właściciela | `private` | `npm run private:start`, tylko `127.0.0.1`. Prawdziwe dane. |
| Demo | Neon Free, gałąź `main` bazy | `demo` | Vercel deployuje tylko gałąź `main`. Tylko dane wygenerowane. |

- Wersja Postgres: **17** wszędzie, gdzie da się ją wybrać (Neon przy
  zakładaniu projektu, `compose.yaml`, CI). Kod nie używa funkcji spoza
  Postgres 16, więc lokalny klaster 16 w sesji agenta wystarcza do testów.
  `pg_dump` musi mieć wersję co najmniej równą serwerowi.
- Bramka i aplikacja działają z dowolnym Postgresem wskazanym przez
  `DATABASE_URL`.
- Deploy demo: merge do `main` → Vercel buduje i wdraża.
- Aktualizacja wersji prywatnej: właściciel robi `git pull` i uruchamia
  `npm run private:start`, który stosuje nowe migracje przed startem.
- Migracje demo: polecenie budowania na Vercel uruchamia `drizzle-kit migrate`
  tylko gdy `VERCEL_ENV=production`. Podglądy PR na Vercel są wyłączone, żeby
  nic poza `main` nie łączyło się z bazą demo.
- Migracje są tylko dodające lub z jawnym planem przejścia; zmiana niszcząca
  dane wymaga decyzji człowieka (WORKFLOW). Dotyczy to przede wszystkim
  `byw_private`, której nie da się odtworzyć z generatora.
- Sekrety: w Vercel (zakres Production) `DATABASE_URL`,
  `DATABASE_URL_UNPOOLED`, `APP_MODE=demo`, `DEMO_IP_SECRET`; lokalnie `.env`
  i `.env.private` (w `.gitignore`).
- Kopia zapasowa dotyczy tylko wersji prywatnej: `npm run private:dump`
  robi `pg_dump` do `backups/`, uruchamiany ręcznie, np. raz w miesiącu po
  rozliczeniu. Awaria dysku oznacza utratę danych, więc właściciel przenosi
  kopię na osobny nośnik. Kopia zawiera prawdziwe dane: nie trafia do
  repozytorium ani do niezaszyfrowanej chmury. Demo nie wymaga kopii.
- Wycofanie demo: „Promote” poprzedniego deploymentu w Vercel; migracje
  dodające są zgodne wstecz, więc stara wersja działa na nowym schemacie.
  Wycofanie wersji prywatnej: `git checkout` poprzedniej wersji
  i `private:start`; przed aktualizacją z nową migracją warto zrobić kopię.

## 7. Bramka jakości

| Polecenie | Zakres |
| --- | --- |
| `npm run lint` | ESLint + `prettier --check` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: domena i integracja z bazą |
| `npm run build` | build produkcyjny Next.js |
| `npm run e2e` | Playwright na zbudowanej aplikacji i testowej bazie, w obu trybach |

CI uruchamia wszystkie pięć przy każdym PR. Poziom weryfikacji zadania
(WORKFLOW, rozdz. 5) decyduje, które polecenia agent musi uruchomić lokalnie.
E2E uruchamia dwa serwery na tym samym buildzie: tryb prywatny (port 3100)
i demo (`APP_MODE=demo`, osobny port); testy demo są osobnym projektem
Playwright.

Scenariusze akceptacyjne z SPEC 12 mają odpowiedniki: obliczeniowe (1, 2, 6,
11, 14, 17) jako testy jednostkowe domeny, przepływy (3–5, 7–10, 13, 15, 16,
18) jako E2E, scenariusz 12 jako E2E w dwóch motywach i przy 360 px,
scenariusze demo (19–21) jako E2E w trybie demo oraz testy jednostkowe
generatora (spójność danych dla wielu wartości `now` i ziaren losowości,
w tym granice miesięcy i przełom roku).

## 8. Największa niewiadoma

Logika obliczeń jest dobrze określona przez specyfikację i nie wymaga spike'a.
Największe ryzyko leży w integracji: Vercel + Neon + migracje + logowanie
w produkcji. Zamiast spike'a pierwsze zadanie planu to **szkielet wdrożony
na produkcję**: pusta aplikacja z logowaniem, jedną tabelą, migracją
i bramką CI, działająca pod adresem `*.vercel.app`. Ten kod zostaje i jest
rozwijany, więc nie wymaga planu usunięcia.

Po zmianie koncepcji (9.4) ryzyko integracji Vercel + Neon zostaje
(zredukowane w T4), a nowym ryzykiem jest generator demo: dane muszą być
spójne z regułami SPEC 6 dla każdej daty wejścia. Odpowiadają za to testy
generatora z rozdz. 7.

## 9. Decyzje człowieka (zaakceptowane 2026-10-20)

1. **Hosting i dane:** aplikacja na Vercel (Hobby), dane finansowe w Neon
   (Free, Frankfurt, UE). Wymaga założenia przez właściciela dwóch darmowych
   kont i połączenia Vercel z repozytorium GitHub.
   **Zmienione 2026-10-21 przez pkt 4:** Vercel i Neon hostują tylko demo.
2. **Domena:** adres `<nazwa>.vercel.app`, zgodnie z SPEC 9 pkt 10 (dla demo).
3. **Kopia zapasowa:** ręczny `pg_dump` zamiast automatycznego (automatyczny
   wymagałby płatnego planu albo dodatkowej usługi). Od 2026-10-21 dotyczy
   bazy wersji prywatnej.
4. **Wersja prywatna i demo (2026-10-21, SPEC P8):** prawdziwe dane tylko
   w lokalnej bazie na komputerze właściciela, aplikacja uruchamiana ręcznie
   i dostępna tylko z tego komputera. Na Vercel + Neon publiczne demo,
   w którym każdy odwiedzający dostaje własną piaskownicę z danymi
   wygenerowanymi. Konsekwencja zaakceptowana świadomie: wersja prywatna nie
   jest dostępna z telefonu ani z innego komputera (SPEC 9 pkt 11).

Pozostałe decyzje z tego dokumentu są techniczne i nie wymagają akceptacji.
