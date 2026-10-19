# BuildYourWealth: specyfikacja MVP

Status: **szkic do akceptacji (etap A)**. Dokument powstał na podstawie wywiadu
z właścicielem produktu (Jakub, 2026-10-19). Proces pracy opisuje
[`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## 1. Problem

Jakub co miesiąc odkłada część przychodu na oszczędności i inwestycje według
ustalonych z góry procentów. Dziś liczy to w arkuszu, co jest uciążliwe:
przychód zmienia się z miesiąca na miesiąc, każda pula dzieli się dalej na kilka
celów, a na koniec trzeba ręcznie dopisać wpłaty do stanu majątku.

## 2. Użytkownik

- MVP: jeden użytkownik, Jakub, do osobistego użytku.
- Kiedyś: być może rodzina i znajomi (poza MVP, patrz rozdz. 9).
- Korzysta głównie na komputerze, czasem na telefonie.

## 3. Oczekiwany rezultat i kryteria sukcesu

Aplikacja jest udana, gdy:

1. Po wpisaniu przychodów miesiąca dokładnie wylicza kwoty na oszczędności,
   inwestycje i każdy cel, bez ręcznych obliczeń.
2. Rozliczenie miesiąca dopisuje faktycznie wpłacone kwoty do majątku, a suma
   oszczędności i inwestycji rośnie z miesiąca na miesiąc.
3. Jakub przestaje używać arkusza do tego celu.

## 4. Pojęcia

| Pojęcie | Znaczenie |
| --- | --- |
| **Źródło** | Miejsce, w którym leżą pieniądze: konto oszczędnościowe, IKE, obligacje, konto maklerskie. Ma nazwę, typ (oszczędność albo inwestycja), walutę (PLN albo EUR) i bieżącą wartość. |
| **Pula** | Oszczędności albo Inwestycje. Każda pula ma procent przychodu miesiąca. |
| **Cel** | Pozycja w puli, np. „Wakacje”. Ma procent puli i jest połączona z jednym źródłem. Może mieć kwotę docelową (opcjonalnie). |
| **Plan podziału** | Zestaw procentów pul i celów. |
| **Miesiąc** | Przychody danego miesiąca kalendarzowego i wyliczony z nich plan. Może być otwarty albo rozliczony. |
| **Do wydania** | Przychód minus kwoty pul, łącznie z różnicami z zaokrągleń. |
| **Majątek** | Suma bieżących wartości wszystkich źródeł, przeliczona na PLN. |

## 5. Funkcje MVP

### 5.1 Logowanie
- Dostęp tylko po zalogowaniu (e-mail lub login i hasło). Bez publicznej rejestracji.
- Konto właściciela tworzone jednorazowo przy wdrożeniu.
- Dane jednego użytkownika nie mogą być widoczne bez zalogowania.

### 5.2 Majątek (źródła)
- Dodawanie, edycja i archiwizacja źródła: nazwa, typ, waluta (PLN lub EUR),
  bieżąca wartość, opcjonalna notatka lub instytucja.
- Bieżącą wartość można w każdej chwili edytować ręcznie (zmiana wyceny,
  wypłata pieniędzy).
- Kurs EUR→PLN jest jednym ustawieniem wpisywanym ręcznie przez użytkownika.
- Widok pokazuje sumę majątku w PLN, osobno sumę oszczędności i inwestycji,
  oraz wartość każdego źródła w jego walucie (dla EUR także w PLN).
- Źródła połączonego z celem nie można zarchiwizować, dopóki cel go używa.

### 5.3 Plan podziału
- Dwie pule: Oszczędności i Inwestycje, każda z procentem przychodu.
- Suma procentów obu pul ≤ 100%.
- W każdej puli dowolna liczba celów; każdy cel ma nazwę, procent puli
  i źródło wybierane z listy źródeł tego samego typu.
- Procenty celów w puli muszą sumować się dokładnie do 100% (pusta pula z 0%
  nie wymaga celów).
- Cel może mieć opcjonalną kwotę docelową. Tylko wtedy pokazuje pasek postępu.
- Po osiągnięciu kwoty docelowej cel jest oznaczony „osiągnięty”, a wpłaty
  idą dalej, dopóki użytkownik nie zmieni procentów.
- Zmiana planu podziału obowiązuje od miesięcy utworzonych po zmianie.
  Istniejące miesiące zachowują plan, z którym powstały.

### 5.4 Ten miesiąc (ekran główny)
- Wpisywanie przychodów bieżącego miesiąca: kilka pozycji (nazwa, kwota netto
  w PLN), sumowanych. Miesiąc powstaje przy pierwszym wpisanym przychodzie.
- Przychody otwartego miesiąca można edytować; plan przelicza się od razu.
- Ekran pokazuje: łączny przychód, kwotę każdej puli, kwotę „do wydania”,
  pasek podziału przychodu i listę „przelewów do wykonania” (cel, źródło,
  procent, kwota, pasek postępu celu, jeśli ma kwotę docelową).
- Dla celu połączonego ze źródłem w EUR kwota jest podana w PLN oraz
  orientacyjnie w EUR według bieżącego kursu.
- Ekran pokazuje sumę majątku i link do sekcji Majątek.

### 5.5 Rozliczenie miesiąca
- Miesiąc można rozliczyć od jego ostatniego dnia.
- Każdy nierozliczony miesiąc z przeszłości jest widoczny jako komunikat
  w aplikacji („Wrzesień 2026 czeka na rozliczenie”) z przyciskiem
  „Rozlicz”. Brak przypomnień poza aplikacją.
- Rozliczenie: lista celów z zaplanowanymi kwotami.
  - „Plan zrealizowany” zatwierdza wszystkie kwoty bez zmian.
  - Albo użytkownik wpisuje faktyczną kwotę przy każdym celu (także 0).
  - Dla źródła w EUR kwota jest dopisywana w EUR; pole jest wstępnie wypełnione
    przeliczeniem po bieżącym kursie i można je poprawić.
- Po zatwierdzeniu faktyczne kwoty są dodawane do bieżącej wartości
  połączonych źródeł, a miesiąc staje się rozliczony i tylko do odczytu.
- Błąd po rozliczeniu poprawia się ręczną edycją wartości źródła.
- Nierozliczone miesiące nie blokują planowania kolejnych.

### 5.6 Historia
- Lista miesięcy z przychodem, planem i wykonaniem dla każdej puli i celu,
  ze statusem otwarty/rozliczony.

### 5.7 Ustawienia
- Kurs EUR→PLN (ręczny).
- Motyw: jasny, ciemny, systemowy (domyślnie systemowy). Wybór jest zapamiętany.
- Wylogowanie.

## 6. Reguły obliczeń

Wszystkie kwoty liczone w groszach (liczby całkowite), bez arytmetyki
zmiennoprzecinkowej.

1. `przychód` = suma pozycji przychodu miesiąca.
2. `kwota puli` = zaokrąglenie w dół do grosza z `przychód × procent puli`.
3. `kwota celu` = zaokrąglenie w dół do grosza z `kwota puli × procent celu`.
4. Różnica między kwotą puli a sumą kwot jej celów (z zaokrągleń) przechodzi
   do „do wydania”, a nie do celów.
5. `do wydania` = `przychód` − suma kwot celów.
6. Postęp celu = wartości z otwartego pytania P1 (rozdz. 11).
7. Majątek w PLN = suma wartości źródeł PLN + suma wartości źródeł EUR × kurs.

Przykład: przychód 9 800,00 zł, oszczędności 20%, inwestycje 15% →
oszczędności 1 960,00 zł, inwestycje 1 470,00 zł, do wydania 6 370,00 zł.
Cel 25% inwestycji = 367,50 zł.

## 7. Przypadki brzegowe

| Sytuacja | Zachowanie |
| --- | --- |
| Miesiąc bez przychodu | Miesiąc nie powstaje i nie wymaga rozliczenia. |
| Przychód 0 zł lub pula 0% | Kwoty 0,00 zł, rozliczenie możliwe. |
| Procenty pul > 100% lub celów ≠ 100% | Zapis planu zablokowany, z komunikatem, co poprawić. |
| Pula > 0%, ale bez celów | Zapis planu zablokowany. |
| Kilka nierozliczonych miesięcy | Wszystkie widoczne na liście do rozliczenia, od najstarszego. |
| Faktyczna kwota większa niż plan | Dozwolona, dodawana tak samo. |
| Ujemna wartość źródła lub ujemna kwota | Niedozwolone. Wypłatę zapisuje się zmniejszeniem wartości źródła. |
| Brak ustawionego kursu EUR przy źródle EUR | Aplikacja prosi o kurs przed pokazaniem sumy majątku. |
| Dwa cele połączone z tym samym źródłem | Dozwolone. |
| Zmiana kursu EUR | Zmienia tylko przeliczenia na PLN; wartości w EUR bez zmian. |

## 8. Kierunek wizualny

Wybrany wariant: **B, „Przepływ pieniędzy”**
(makiety: https://claude.ai/artifact/QzpWJfXNTrTvD5VFVmV1qC, artboard
„B · Przepływ pieniędzy”; dostęp ma właściciel).

- Nawigacja na górze: logo, zakładki Ten miesiąc, Majątek, Plan podziału,
  Historia, Ustawienia (aktywna jako pigułka), przełącznik motywu.
- Treść w wyśrodkowanej kolumnie (max ok. 1120 px), przestronnie, duża typografia.
- Ekran „Ten miesiąc”, od góry: komunikat o nierozliczonym miesiącu (pigułka),
  nagłówek z miesiącem i przychodem, duże zdanie „W tym miesiącu odkładasz X,
  a do wydania zostaje Y”, gruby pasek podziału przychodu z legendą, dwie karty
  „Przelewy do wykonania” (Oszczędności, Inwestycje), ciemny pasek z sumą majątku.
- Kolory: oszczędności morski (#0E7490 jasny / #2BB3C9 ciemny), inwestycje indygo
  (#4338CA / #8C85FF), „do wydania” neutralny szary.
- Typografia: Sora (nagłówki, kwoty), DM Sans (tekst). Cyfry tabelaryczne.
- Oba motywy, kontrast tekstu co najmniej 4.5:1, cele dotyku co najmniej 44 px.
- Responsywność: projektowane pod komputer, w pełni używalne od 360 px szerokości.
- Język interfejsu: polski. Format liczb: `1 960,00 zł`, `220,50 €`.
- Pozostałe ekrany (Majątek, Plan podziału, Historia, Rozliczenie, Ustawienia,
  Logowanie) w tym samym stylu; patrz otwarte pytanie P2.

## 9. Poza MVP (świadomie odłożone)

1. Automatyczny kurs EUR z API NBP (pierwsza funkcja po MVP).
2. Powiadomienia o rozliczeniu (e-mail lub push).
3. Konta dla rodziny i znajomych, rejestracja.
4. Wykres wartości majątku w czasie.
5. Eksport danych do CSV.
6. Import danych z obecnego arkusza.
7. Śledzenie wydatków.
8. Waluty inne niż PLN i EUR, przychody w EUR.
9. Wpłata na cel wyliczana z kwoty docelowej i terminu.
10. Własna domena (możliwa w przyszłości, nie wymagana).

## 10. Ograniczenia

- **Zero kosztów:** hosting, baza danych i domena mieszczą się w darmowych
  planach. Akceptujemy ograniczenia darmowych planów (np. usypianie serwera).
- Aplikacja webowa dostępna przez internet, HTTPS.
- Dane trwałe w bazie danych.
- Wybór stosu technologicznego: etap C (`STACK.md`), bez preferencji właściciela.

## 11. Fakty, założenia, decyzje, otwarte pytania

**Fakty (od właściciela):** problem i obecny arkusz; jeden użytkownik w MVP;
przychody netto, kilka źródeł; podział procentowy pul i celów; źródła z ręcznie
edytowaną wartością; rozliczenie na koniec miesiąca; zero kosztów; logowanie;
głównie komputer.

**Decyzje (potwierdzone przez właściciela):** reszta przychodu tylko jako
„do wydania”; cel połączony ze źródłem wybieranym z listy; wypłaty przez ręczną
edycję wartości; zmiana planu tylko na przyszłość; powiadomienie tylko
w aplikacji; zaokrąglenia do grosza z resztą do „do wydania”; walidacja
procentów; rozliczony miesiąc zablokowany; zaległe miesiące nie blokują;
waluta per źródło z ręcznym kursem; wpłata na cel procentowa, kwota docelowa
tylko do postępu; MVP z celami i historią, bez wykresu, eksportu i importu;
wariant wizualny B; oba motywy.

**Założenia (przyjęte przez agenta, do potwierdzenia przy akceptacji):**
- Z1: brak publicznej rejestracji, konto tworzone przy wdrożeniu, reset hasła
  bez e-maila (operacja administracyjna).
- Z2: miesiąc powstaje przy pierwszym przychodzie i dostaje plan podziału
  obowiązujący w tej chwili.
- Z3: rozliczenie możliwe od ostatniego dnia miesiąca.
- Z4: przychody zawsze w PLN; EUR dotyczy tylko źródeł.
- Z5: zaokrąglenie w dół na poziomie puli i celu (rozdz. 6).
- Z6: domyślny motyw zgodny z ustawieniem systemu.

**Otwarte pytania:**
- **P1 (blokujące):** jak liczyć postęp celu z kwotą docelową?
  a) suma rozliczonych wpłat na ten cel plus kwota początkowa podana przy
  tworzeniu celu; b) bieżąca wartość połączonego źródła (prostsze, uwzględnia
  wypłaty, ale wymaga osobnego źródła dla każdego celu z kwotą docelową).
  Rekomendacja: **a**.
- **P2:** czy przed etapem C przygotować makiety pozostałych ekranów
  (szczególnie Rozliczenie i Plan podziału)? Rekomendacja: **tak**, dla tych
  dwóch.

## 12. Scenariusze akceptacyjne

1. **Plan miesiąca:** przy planie Oszczędności 20% (Poduszka 50%, Wakacje 30%,
   Rezerwa 20%) i Inwestycje 15% (ETF 60%, Obligacje 25%, Akcje 15%) po wpisaniu
   przychodów 8 500 zł i 1 300 zł ekran pokazuje: przychód 9 800,00 zł,
   oszczędności 1 960,00 zł (980,00 / 588,00 / 392,00), inwestycje 1 470,00 zł
   (882,00 / 367,50 / 220,50), do wydania 6 370,00 zł.
2. **Zaokrąglenie:** przychód 1 000,01 zł, pula 33%, cele 50/50 → pula 330,00 zł,
   cele po 165,00 zł, do wydania 670,01 zł.
3. **Walidacja:** zapis planu z celami 60% + 30% w puli jest odrzucony
   z komunikatem, że brakuje 10%.
4. **Rozliczenie zgodne z planem:** po „Plan zrealizowany” wartości źródeł rosną
   o zaplanowane kwoty, miesiąc ma status rozliczony i nie da się go edytować.
5. **Rozliczenie częściowe:** wpisanie 500 zł zamiast 980 zł przy Poduszce
   zwiększa jej źródło o 500 zł, a historia pokazuje plan 980,00 i wykonanie 500,00.
6. **Źródło w EUR:** przy kursie 4,30 i celu 220,50 zł pole rozliczenia jest
   wstępnie wypełnione kwotą 51,28 €; po zatwierdzeniu źródło EUR rośnie
   o wpisaną kwotę w EUR, a suma majątku w PLN uwzględnia kurs.
7. **Zaległy miesiąc:** gdy wrzesień nie jest rozliczony, w październiku widać
   komunikat o wrześniu, a plan października działa normalnie.
8. **Zmiana planu:** zmiana procentów w październiku nie zmienia planu
   istniejącego miesiąca października ani historii; dotyczy listopada.
9. **Wypłata:** ręczne zmniejszenie wartości źródła zmniejsza sumę majątku.
10. **Cel osiągnięty:** cel z kwotą docelową 5 000 zł po przekroczeniu tej kwoty
    pokazuje „osiągnięty”, a kolejny miesiąc nadal planuje na niego wpłatę.
11. **Motywy i telefon:** wszystkie ekrany działają w obu motywach i przy
    szerokości 360 px bez przewijania w poziomie.
12. **Dostęp:** bez zalogowania żaden ekran ani endpoint nie zwraca danych.
