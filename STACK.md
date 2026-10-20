# BuildYourWealth: decyzje techniczne

Status: **zatwierdzony przez właściciela produktu (etap C, 2026-10-20)**,
łącznie z decyzjami z rozdz. 9. Dokument opisuje trwałe decyzje techniczne dla MVP
z [`SPEC.md`](SPEC.md). Zakres i zachowanie produktu opisuje wyłącznie `SPEC.md`;
w razie konfliktu agent zgłasza go, zamiast wybierać wygodniejszą wersję.

## 1. Założenia wejściowe

Decyzje wynikają z ograniczeń specyfikacji:

- zero kosztów, akceptowane usypianie (SPEC 10);
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
| Hosting aplikacji | Vercel, plan Hobby (region `fra1`) | Darmowy dla użytku osobistego, HTTPS i deploy z GitHub bez konfiguracji. |
| Hosting bazy | Neon, plan Free (region Frankfurt) | Darmowy, usypia po 5 min i budzi się przy połączeniu; nie wstrzymuje projektu za brak aktywności. |
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
  app/         strony (Server Components) i Server Actions
  ui/          współdzielone komponenty i style
drizzle/       wygenerowane migracje SQL (commitowane)
scripts/       migracja, tworzenie konta, reset hasła
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
kwota wpisywana przez użytkownika ma górną granicę 2 mld (zł lub €).
Iloczyny pośrednie (kwota × procent, kwota × kurs) domena liczy na `BigInt`,
bo przy kursie powyżej ok. 4,5 iloczyn kwoty 2 mld przekracza
`Number.MAX_SAFE_INTEGER`; wynik po zaokrągleniu wraca jako `number`, a
funkcje domeny zgłaszają błąd, jeśli nie mieści się w bezpiecznym zakresie.

| Tabela | Kolumny (skrót) | Uwagi |
| --- | --- | --- |
| `users` | id, email, password_hash | Jedno konto w MVP. |
| `sessions` | id (hash tokenu), user_id, expires_at | Token w ciasteczku, w bazie tylko hash. |
| `settings` | user_id, eur_rate (null = brak), savings_pct, investments_pct | Kurs i procenty pul bieżącego planu. |
| `sources` | id, user_id, name, kind, currency, value, note, archived_at | `kind`: savings / investments; `currency`: PLN / EUR. |
| `goals` | id, user_id, pool, name, pct, source_id, target_amount, start_amount, position, removed_at | Usunięcie z planu ustawia `removed_at`; tożsamość celu się nie zmienia. |
| `months` | id, user_id, month (`YYYY-MM`), savings_pct, investments_pct, settled_at, settled_eur_rate | Unikalne (user_id, month). Migawka procentów pul. |
| `month_goals` | month_id, goal_id, pool, pct, source_id, actual_amount | Migawka celów; `actual_amount` w walucie źródła, null do rozliczenia. |
| `incomes` | id, month_id, name, amount | Pozycje przychodu. |

Tabele mają `user_id`, bo dostęp i tak jest sprawdzany per użytkownik; nie
budujemy niczego więcej dla wielu kont (rejestracji, ról, zaproszeń).

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
  ręcznie z `DATABASE_URL` produkcji (SPEC, założenie Z1).

### Motyw

Wybór motywu w ciasteczku (nie w `localStorage`). Skrypt w `<head>` czyta
ciasteczko i ustawia motyw przed pierwszym malowaniem, więc nie ma mignięcia,
a strony nadal mogą być prerenderowane (odczyt `cookies()` w root layoutcie
zablokowałby to przy Cache Components). Brak ciasteczka oznacza motyw
systemowy przez `prefers-color-scheme`.

### Usypianie

Baza Neon budzi się w czasie rzędu sekund. Strony pokazują `loading.tsx`
ze wskaźnikiem, a błąd połączenia przy zapisie daje komunikat z SPEC 7.

## 6. Środowiska i wdrożenie

| Środowisko | Baza | Uwagi |
| --- | --- | --- |
| Lokalne | Postgres w Dockerze (`docker compose up db`) | Plik `compose.yaml` w repozytorium. |
| Sesja chmurowa agenta | Lokalny klaster Postgres w kontenerze | Demon Dockera nie działa; hook SessionStart uruchamia klaster. |
| CI | Postgres jako kontener usługi GitHub Actions | Świeża baza dla każdego uruchomienia. |
| Produkcja | Neon Free, gałąź `main` bazy | Vercel deployuje tylko gałąź `main`. |

- Wersja Postgres: **17** wszędzie, gdzie da się ją wybrać (Neon przy
  zakładaniu projektu, `compose.yaml`, CI). Kod nie używa funkcji spoza
  Postgres 16, więc lokalny klaster 16 w sesji agenta wystarcza do testów.
  `pg_dump` musi mieć wersję co najmniej równą serwerowi.
- Bramka i aplikacja działają z dowolnym Postgresem wskazanym przez
  `DATABASE_URL`.
- Deploy produkcyjny: merge do `main` → Vercel buduje i wdraża.
- Migracje: polecenie budowania na Vercel uruchamia `drizzle-kit migrate`
  tylko gdy `VERCEL_ENV=production`. Podglądy PR na Vercel są wyłączone, żeby
  nic poza produkcją nie łączyło się z bazą produkcyjną.
- Migracje są tylko dodające lub z jawnym planem przejścia; zmiana niszcząca
  dane wymaga decyzji człowieka (WORKFLOW).
- Sekrety (`DATABASE_URL`) tylko w ustawieniach Vercel i lokalnym `.env`
  (w `.gitignore`).
- Kopia zapasowa: Neon Free przechowuje historię zmian przez krótki okres.
  Dodatkowo skrypt `npm run db:dump` robi `pg_dump` lokalnie; uruchamiany
  ręcznie, np. raz w miesiącu po rozliczeniu.
- Wycofanie: „Promote” poprzedniego deploymentu w Vercel; migracje dodające
  są zgodne wstecz, więc stara wersja działa na nowym schemacie.

## 7. Bramka jakości

| Polecenie | Zakres |
| --- | --- |
| `npm run lint` | ESLint + `prettier --check` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest: domena i integracja z bazą |
| `npm run build` | build produkcyjny Next.js |
| `npm run e2e` | Playwright na zbudowanej aplikacji i testowej bazie |

CI uruchamia wszystkie pięć przy każdym PR. Poziom weryfikacji zadania
(WORKFLOW, rozdz. 5) decyduje, które polecenia agent musi uruchomić lokalnie.

Scenariusze akceptacyjne z SPEC 12 mają odpowiedniki: obliczeniowe (1, 2, 6,
11, 14, 17) jako testy jednostkowe domeny, przepływy (3–5, 7–10, 13, 15, 16,
18) jako E2E, scenariusz 12 jako E2E w dwóch motywach i przy 360 px.

## 8. Największa niewiadoma

Logika obliczeń jest dobrze określona przez specyfikację i nie wymaga spike'a.
Największe ryzyko leży w integracji: Vercel + Neon + migracje + logowanie
w produkcji. Zamiast spike'a pierwsze zadanie planu to **szkielet wdrożony
na produkcję**: pusta aplikacja z logowaniem, jedną tabelą, migracją
i bramką CI, działająca pod adresem `*.vercel.app`. Ten kod zostaje i jest
rozwijany, więc nie wymaga planu usunięcia.

## 9. Decyzje człowieka (zaakceptowane 2026-10-20)

1. **Hosting i dane:** aplikacja na Vercel (Hobby), dane finansowe w Neon
   (Free, Frankfurt, UE). Wymaga założenia przez właściciela dwóch darmowych
   kont i połączenia Vercel z repozytorium GitHub.
2. **Domena:** adres `<nazwa>.vercel.app`, zgodnie z SPEC 9 pkt 10.
3. **Kopia zapasowa:** ręczny `pg_dump` zamiast automatycznego (automatyczny
   wymagałby płatnego planu albo dodatkowej usługi).

Pozostałe decyzje z tego dokumentu są techniczne i nie wymagają akceptacji.
