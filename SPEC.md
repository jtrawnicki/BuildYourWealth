# BuildYourWealth: specyfikacja MVP

Status: **zaakceptowana przez właściciela produktu, po review etapu B
(2026-10-19)**; zmiana koncepcji wdrożenia (wersja prywatna i demo, P8)
z 2026-10-21. Dokument powstał na podstawie wywiadu z właścicielem produktu.
Proces pracy opisuje
[`docs/WORKFLOW.md`](docs/WORKFLOW.md).

## 1. Problem

Użytkownik co miesiąc odkłada część przychodu na oszczędności i inwestycje według
ustalonych z góry procentów. Bez aplikacji liczy to w arkuszu, co jest uciążliwe:
przychód zmienia się z miesiąca na miesiąc, każda pula dzieli się dalej na kilka
celów, a na koniec trzeba ręcznie dopisać wpłaty do stanu majątku.

## 2. Użytkownik

- Osoba, która chce regularnie odkładać ustaloną część zmiennego przychodu
  i śledzić swój majątek w jednym miejscu.
- MVP: jedno konto użytkownika, do osobistego użytku, w wersji prywatnej
  działającej tylko na jego komputerze (rozdz. 10).
- Później: kolejni użytkownicy, np. rodzina i znajomi (poza MVP, patrz rozdz. 9).
- Korzysta z wersji prywatnej na komputerze. Telefon i dostęp z innych
  urządzeń są poza MVP (rozdz. 9).
- Oglądający: osoby, którym właściciel pokazuje efekty pracy. Korzystają
  z publicznej wersji demo (5.8) na komputerze albo telefonie.

## 3. Oczekiwany rezultat i kryteria sukcesu

Aplikacja jest udana, gdy:

1. Po wpisaniu przychodów miesiąca dokładnie wylicza kwoty na oszczędności,
   inwestycje i każdy cel, bez ręcznych obliczeń.
2. Rozliczenie miesiąca dopisuje faktycznie wpłacone kwoty do majątku, a suma
   oszczędności i inwestycji rośnie z miesiąca na miesiąc.
3. Użytkownik nie potrzebuje już arkusza do tego celu.

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
- Dotyczy wersji prywatnej. W wersji demo zamiast logowania jest wejście
  do piaskownicy (5.8).
- Dostęp tylko po zalogowaniu (e-mail i hasło). Bez publicznej rejestracji.
- Konto użytkownika tworzone jednorazowo przy pierwszym uruchomieniu wersji
  prywatnej.
- Dane jednego użytkownika nie mogą być widoczne bez zalogowania.

### 5.2 Majątek (źródła)
- Dodawanie, edycja i archiwizacja źródła: nazwa, typ, waluta (PLN lub EUR),
  bieżąca wartość, opcjonalna notatka lub instytucja.
- Bieżącą wartość można w każdej chwili edytować ręcznie (zmiana wyceny,
  wypłata pieniędzy).
- Kurs EUR→PLN jest jednym ustawieniem wpisywanym ręcznie przez użytkownika.
- Widok pokazuje sumę majątku w PLN, osobno sumę oszczędności i inwestycji,
  oraz wartość każdego źródła w jego walucie (dla EUR także w PLN).
- Źródła nie można zarchiwizować, dopóki używa go cel w bieżącym planie albo
  w planie nierozliczonego miesiąca.
- Typu i waluty źródła nie można zmienić, jeśli źródło jest połączone z celem
  albo ma rozliczone wpłaty. Nazwę i notatkę można zmieniać zawsze.
- Zarchiwizować można tylko źródło o wartości 0 (najpierw trzeba wyzerować
  wartość, np. po wypłacie). Zarchiwizowane źródło nie liczy się do majątku
  ani do liczby źródeł i nie pojawia się na liście wyboru celów.

### 5.3 Plan podziału
- Dwie pule: Oszczędności i Inwestycje, każda z procentem przychodu.
- Suma procentów obu pul ≤ 100%.
- W każdej puli dowolna liczba celów; każdy cel ma nazwę, procent puli
  (większy od 0) i źródło wybierane z listy źródeł tego samego typu.
- Procenty pul i celów mają najwyżej 2 miejsca po przecinku (np. 33,33%).
- Procenty celów w puli muszą sumować się dokładnie do 100,00%. Pula z 0%
  może nie mieć celów; jeśli je ma, obowiązuje ta sama reguła.
- Cel może mieć opcjonalną kwotę docelową oraz opcjonalną kwotę startową
  (ile już uzbierano przed rozpoczęciem korzystania z aplikacji). Tylko cel
  z kwotą docelową pokazuje pasek postępu.
- Gdy postęp jest większy lub równy kwocie docelowej, cel jest oznaczony „osiągnięty”, a wpłaty
  idą dalej, dopóki użytkownik nie zmieni procentów.
- Zmiana planu podziału obowiązuje od miesięcy utworzonych po zmianie.
  Istniejące miesiące zachowują plan, z którym powstały.
- Każdy miesiąc zapamiętuje migawkę planu: procenty pul, procenty celów
  i źródło każdego celu. Nazwa, kwota docelowa i kwota startowa są bieżącymi
  atrybutami celu i ich zmiana działa od razu, także w widoku starszych miesięcy.
- Cel ma stałą tożsamość: edycja go nie zmienia, więc postęp liczy się dalej.
  Usunięcie celu z planu nie zmienia historii ani nierozliczonych miesięcy,
  które go zawierają.

### 5.4 Ten miesiąc (ekran główny)
- Wpisywanie przychodów bieżącego miesiąca: kilka pozycji (nazwa, kwota netto
  w PLN), sumowanych. Miesiąc powstaje przy pierwszym wpisanym przychodzie.
- Przychody otwartego miesiąca można dodawać, edytować i usuwać; plan
  przelicza się od razu.
- Przychody każdego nierozliczonego miesiąca można edytować także po jego
  zakończeniu (wejście z pigułki zaległości albo z Historii).
- Jeśli poprzedni miesiąc kalendarzowy nie istnieje, użytkownik może go
  utworzyć, wpisując za niego przychód. Dostaje plan obowiązujący w chwili
  utworzenia i od razu czeka na rozliczenie. Starszych miesięcy nie można
  tworzyć.
- Pusty stan (brak przychodu w bieżącym miesiącu): zachęta „Wpisz przychód
  z października” i przycisk „Dodaj przychód”; plan nie jest pokazywany.
- Po rozliczeniu bieżącego miesiąca ekran pokazuje go jako rozliczony, tylko
  do odczytu, z kwotami faktycznymi.
- Ekran pokazuje: łączny przychód, kwotę każdej puli, kwotę „do wydania”,
  pasek podziału przychodu i listę „przelewów do wykonania” (cel, źródło,
  procent, kwota, pasek postępu celu, jeśli ma kwotę docelową).
- Kwota puli pokazywana wszędzie (karty, legenda, zdanie „odkładasz X”,
  Historia) to suma kwot jej celów (reguła 6.4).
- Dla celu połączonego ze źródłem w EUR kwota jest podana w PLN oraz
  orientacyjnie w EUR według bieżącego kursu (reguła 6.8). Bez ustawionego
  kursu zamiast kwoty w EUR jest link „Ustaw kurs EUR”.
- Ekran pokazuje sumę majątku i link do sekcji Majątek.

### 5.5 Rozliczenie miesiąca
- Miesiąc można rozliczyć od jego ostatniego dnia (strefa czasowa
  Europe/Warsaw).
- Każdy nierozliczony miesiąc z przeszłości jest widoczny jako osobna pigułka
  „Wrzesień 2026 czeka na rozliczenie” z linkiem „Rozlicz”, od najstarszego.
  Brak przypomnień poza aplikacją.
- Ekran rozliczenia (makieta B2): użytkownik wybiera jedną z dwóch opcji,
  a potem zatwierdza przyciskiem „Zatwierdź rozliczenie”.
  - „Tak, plan zrealizowany”: faktyczne kwoty = zaplanowane.
  - „Nie, wpiszę faktyczne kwoty”: pole przy każdym celu, wstępnie wypełnione
    kwotą planu; dozwolone 0.
  - Dla źródła w EUR kwota jest zapisywana w EUR. W obu opcjach jest to kwota
    planu przeliczona po bieżącym kursie (reguła 6.8); w trybie ręcznym można
    ją poprawić. Bez ustawionego kursu rozliczenia nie da się zatwierdzić,
    a ekran prosi o kurs.
- Po zatwierdzeniu faktyczne kwoty są dodawane do bieżącej wartości
  połączonych źródeł, kurs użyty przy rozliczeniu jest zapisywany, a miesiąc
  staje się rozliczony i tylko do odczytu.
- Rozliczenie jest atomowe i jednorazowe: albo zapisują się wszystkie kwoty,
  albo żadna. Ponowna próba rozliczenia (druga karta, podwójne kliknięcie)
  jest odrzucana komunikatem „Ten miesiąc jest już rozliczony”.
- Błąd po rozliczeniu poprawia się ręczną edycją wartości źródła, a postęp
  celu ręczną edycją jego kwoty startowej („Już uzbierane”). Rozliczony
  miesiąc i historia pozostają bez zmian.
- Nierozliczone miesiące nie blokują planowania kolejnych.

### 5.6 Historia
- Lista miesięcy z przychodem, planem i wykonaniem dla każdej puli i celu,
  ze statusem otwarty/rozliczony.
- Wykonanie celu EUR jest pokazane w EUR oraz w PLN po kursie zapisanym przy
  rozliczeniu, więc późniejsza zmiana kursu nie zmienia historii.

### 5.7 Ustawienia
- Kurs EUR→PLN (ręczny).
- Motyw: jasny, ciemny, systemowy (domyślnie systemowy). Wybór jest zapamiętany
  w przeglądarce. Przycisk motywu w nagłówku ustawia motyw przeciwny do
  widocznego; powrót do „systemowy” jest tylko w Ustawieniach.
- Wylogowanie.

### 5.8 Wersja demo
Publiczna wersja aplikacji do pokazywania efektów pracy. Działa tak samo jak
wersja prywatna (5.2–5.7), ale zawiera wyłącznie dane wygenerowane i nigdy
nie ma dostępu do danych z wersji prywatnej.

- **Wejście:** zamiast formularza logowania ekran startowy z krótkim opisem
  aplikacji i przyciskiem „Wypróbuj wersję demo”. Logowanie e-mailem
  i hasłem nie istnieje.
- **Piaskownica:** każde wejście tworzy osobną kopię aplikacji z nowymi
  danymi przykładowymi i od razu otwiera ekran „Ten miesiąc”. Oglądający może
  robić wszystko, co użytkownik wersji prywatnej (wpisywać przychody,
  zmieniać plan, rozliczać, archiwizować). Zmian nie widzi nikt inny.
- **Dane przykładowe** są losowane przy każdym wejściu, z datami względem
  dnia wejścia, i pokazują wszystkie ekrany w użyciu:
  - ustawiony kurs EUR;
  - kilka źródeł obu typów, w tym co najmniej jedno w EUR;
  - plan z obiema pulami i 2–3 celami w każdej; wśród celów: co najmniej
    jeden ze źródłem EUR, jeden z kwotą docelową i postępem w toku, jeden
    osiągnięty i jeden bez kwoty docelowej;
  - bieżący miesiąc z 2–3 pozycjami przychodu, nierozliczony;
  - poprzedni miesiąc nierozliczony (widać pigułkę zaległości);
  - kilka wcześniejszych miesięcy rozliczonych, co najmniej jeden
    z faktycznymi kwotami innymi niż plan;
  - wartości źródeł i postępy celów zgodne z rozliczeniami (reguły rozdz. 6).
- **Baner** na każdym ekranie demo: „Wersja demonstracyjna. Dane są
  przykładowe, widzisz je tylko Ty i znikną po 24 godzinach.”
- **Czas życia:** piaskownica działa 24 godziny od wejścia. Potem jej dane są
  usuwane, a kolejna wizyta pokazuje ekran startowy. „Wyloguj” kończy
  piaskownicę od razu.
- **Limity:** najwyżej 10 nowych piaskownic na godzinę z jednego adresu IP
  i najwyżej 500 aktywnych naraz. Po przekroczeniu ekran startowy pokazuje
  odpowiednio „Za dużo wejść do wersji demo. Spróbuj ponownie za godzinę.”
  albo „Wersja demo jest teraz przeciążona. Spróbuj ponownie później.”
- Demo działa na darmowym hostingu, więc pierwsze wejście po przerwie może
  trwać kilka sekund (wskaźnik ładowania, rozdz. 7).

## 6. Reguły obliczeń

Wszystkie kwoty liczone w groszach lub eurocentach (liczby całkowite),
procenty w setnych częściach procenta (33,33% = 3333), kurs z 4 miejscami po
przecinku. Bez arytmetyki zmiennoprzecinkowej.

1. `przychód` = suma pozycji przychodu miesiąca.
2. `kwota bazowa puli` = zaokrąglenie w dół do grosza z
   `przychód × procent puli`. To wartość pośrednia, nie jest pokazywana.
3. `kwota celu` = zaokrąglenie w dół do grosza z
   `kwota bazowa puli × procent celu`.
4. `kwota puli` (pokazywana) = suma kwot jej celów. Różnica z zaokrągleń
   przechodzi do „do wydania”.
5. `do wydania` = `przychód` − suma kwot celów.
6. Postęp celu = kwota startowa + suma faktycznych kwot z rozliczonych miesięcy
   dla tego celu. Ręczne zmiany wartości źródła (wycena, wypłata) nie zmieniają
   postępu celu.
7. Majątek w PLN = suma wartości źródeł PLN + suma przeliczeń wartości źródeł
   EUR na PLN (reguła 8).
8. Przeliczenia PLN↔EUR: `EUR = PLN ÷ kurs`, `PLN = EUR × kurs`, zaokrąglone
   do najbliższego grosza lub eurocenta, połówki w górę. Każde źródło jest
   przeliczane osobno, potem sumowane.
9. Kwota docelowa, kwota startowa i postęp celu są w walucie jego źródła.
   Dla celu ze źródłem EUR postęp sumuje faktyczne kwoty w EUR, bez
   przeliczania kursem. Zmiana źródła celu na źródło w innej walucie jest
   zablokowana, jeśli cel ma kwotę docelową, startową albo rozliczone wpłaty.

Przykład: przychód 9 800,00 zł, oszczędności 20%, inwestycje 15% →
oszczędności 1 960,00 zł, inwestycje 1 470,00 zł, do wydania 6 370,00 zł.
Cel 25% inwestycji = 367,50 zł.

Przykład z resztą z zaokrągleń: przychód 9 650,00 zł, inwestycje 15% (cele
60/25/15) → kwota bazowa 1 447,50 zł, cele 868,50 + 361,87 + 217,12, kwota puli
pokazywana 1 447,49 zł, a 0,01 zł przechodzi do „do wydania”.

## 7. Przypadki brzegowe

| Sytuacja | Zachowanie |
| --- | --- |
| Miesiąc bez przychodu | Miesiąc nie powstaje i nie wymaga rozliczenia. |
| Pula 0% | Kwoty 0,00 zł, rozliczenie możliwe. |
| Usunięcie wszystkich przychodów nierozliczonego miesiąca | Miesiąc jest usuwany razem z migawką planu: wraca pusty stan, znika pigułka zaległości. Ponowny przychód tworzy miesiąc z planem obowiązującym w tej chwili (o ile miesiąc wolno utworzyć, rozdz. 5.4). |
| Procenty pul > 100% lub celów ≠ 100% | Zapis planu zablokowany, z komunikatem, co poprawić. |
| Pula > 0%, ale bez celów | Zapis planu zablokowany komunikatem „Suma celów: 0%. Brakuje 100%” (pula bez celów ma sumę celów 0%, patrz 7.1). |
| Kilka nierozliczonych miesięcy | Wszystkie widoczne na liście do rozliczenia, od najstarszego. |
| Faktyczna kwota większa niż plan | Dozwolona, dodawana tak samo. |
| Ujemna wartość źródła lub ujemna kwota | Niedozwolone. Wypłatę zapisuje się zmniejszeniem wartości źródła. |
| Brak ustawionego kursu EUR przy źródle EUR | Aplikacja prosi o kurs przed pokazaniem sumy majątku. |
| Dwa cele połączone z tym samym źródłem | Dozwolone. |
| Zmiana kursu EUR | Zmienia tylko bieżące przeliczenia na PLN; wartości w EUR i rozliczone miesiące bez zmian. |
| Brak kursu EUR przy celu EUR | „Ten miesiąc” pokazuje link „Ustaw kurs EUR” zamiast kwoty w EUR; rozliczenia nie da się zatwierdzić. |
| Ponowne rozliczenie tego samego miesiąca | Odrzucone: „Ten miesiąc jest już rozliczony”. |
| Błąd zapisu lub serwer budzący się po uśpieniu | Komunikat „Nie udało się zapisać. Spróbuj ponownie.”; wpisane dane zostają w formularzu. Długie ładowanie pokazuje wskaźnik. |

### 7.1 Walidacja pól

| Pole | Reguła | Komunikat |
| --- | --- | --- |
| Kwoty (przychód, wartość źródła, faktyczna, docelowa, startowa) | Liczba ≥ 0, najwyżej 2 miejsca po przecinku. Separator `,` lub `.`, spacje ignorowane (`1 234,56` = `1234.56`). | „Wpisz kwotę, np. 1 234,56” |
| Kwota przychodu | Jak wyżej i > 0; nazwa pozycji wymagana. | „Kwota przychodu musi być większa od 0” |
| Kwota docelowa, kwota startowa | Puste = brak. | jak dla kwot |
| Faktyczna kwota w rozliczeniu | Wymagana (może być 0). | „Wpisz kwotę albo 0” |
| Procent puli | 0–100, najwyżej 2 miejsca po przecinku. | „Wpisz procent od 0 do 100” |
| Procent celu | > 0 i ≤ 100, najwyżej 2 miejsca po przecinku. | „Wpisz procent większy od 0” |
| Suma pul | ≤ 100%. | „Pule przekraczają przychód o X%” |
| Suma celów w puli | = 100,00%. Pula > 0% bez celów ma sumę 0% i wpada pod tę regułę (komunikat „Suma celów: 0%. Brakuje 100%”). | „Suma celów: X%. Brakuje Y%” albo „…Za dużo o Y%” |
| Kurs EUR | > 0, najwyżej 4 miejsca po przecinku. | „Wpisz kurs, np. 4,2850” |
| Nazwy (źródło, cel, przychód) | Wymagane, najwyżej 60 znaków. | „Wpisz nazwę” |

## 8. Kierunek wizualny

Wybrany wariant: **B, „Przepływ pieniędzy”**
(makiety: https://claude.ai/artifact/QzpWJfXNTrTvD5VFVmV1qC, artboard
„B · Przepływ pieniędzy”; dostęp ma właściciel produktu).

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
- Język interfejsu: polski. Format liczb: `1 960,00 zł`, `220,50 €`; wyjątek:
  postęp celu bez groszy, np. `3 100 / 5 000 zł`.
- Elementy „Ten miesiąc” nieujęte w makiecie B1:
  - przychody jako rozwijana lista pozycji pod nagłówkiem z miesiącem, każda
    z edycją i usuwaniem, plus przycisk „Dodaj przychód”;
  - pusty stan opisany w 5.4;
  - każda zaległość jako osobna pigułka nad nagłówkiem, od najstarszej;
  - przy celu EUR druga linia kwoty, np. `≈ 51,28 €`;
  - cel osiągnięty: pełny pasek i etykieta „osiągnięty” zamiast liczb postępu.
- Makiety ekranów Rozliczenie i Plan podziału są w tym samym pliku makiet
  (artboardy „B2 · Rozliczenie miesiąca” i „B3 · Plan podziału”).
- Pozostałe ekrany (Majątek, Historia, Ustawienia, Logowanie) w tym samym stylu,
  bez osobnych makiet.
- Źródła makiet są w repozytorium: [`docs/design/`](docs/design/README.md).

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
10. Własna domena dla wersji demo (możliwa w przyszłości, nie wymagana).
11. Dostęp do wersji prywatnej z telefonu lub innego komputera (np. przez
    prywatną sieć VPN między urządzeniami właściciela).

## 10. Ograniczenia

- **Zero kosztów:** hosting, baza danych i domena mieszczą się w darmowych
  planach. Akceptujemy ograniczenia darmowych planów (np. usypianie serwera).
- **Wersja prywatna** (prawdziwe dane): działa wyłącznie na komputerze
  właściciela, uruchamiana przez niego ręcznie, dostępna tylko z tego
  komputera (nie z sieci lokalnej ani z internetu). Dane w lokalnej bazie
  danych, kopia zapasowa ręczna.
- **Wersja demo:** aplikacja webowa dostępna publicznie przez internet,
  HTTPS, wyłącznie z danymi wygenerowanymi (5.8).
- Dane trwałe w bazie danych.
- Wybór stosu technologicznego: etap C (`STACK.md`), bez preferencji właściciela produktu.

## 11. Fakty, założenia, decyzje, otwarte pytania

**Fakty (od właściciela produktu):** problem i obecny arkusz; jeden użytkownik w MVP;
przychody netto, kilka źródeł; podział procentowy pul i celów; źródła z ręcznie
edytowaną wartością; rozliczenie na koniec miesiąca; zero kosztów; logowanie;
głównie komputer.

**Decyzje (potwierdzone przez właściciela produktu):** reszta przychodu tylko jako
„do wydania”; cel połączony ze źródłem wybieranym z listy; wypłaty przez ręczną
edycję wartości; zmiana planu tylko na przyszłość; powiadomienie tylko
w aplikacji; zaokrąglenia do grosza z resztą do „do wydania”; walidacja
procentów; rozliczony miesiąc zablokowany; zaległe miesiące nie blokują;
waluta per źródło z ręcznym kursem; wpłata na cel procentowa, kwota docelowa
tylko do postępu; MVP z celami i historią, bez wykresu, eksportu i importu;
wariant wizualny B; oba motywy; postęp celu liczony z rozliczonych wpłat
plus kwoty startowej (P1); makiety Rozliczenia i Planu podziału (P2);
kwoty celu w walucie źródła (P3); archiwizacja tylko źródła o wartości 0 (P4);
korekta postępu przez kwotę startową (P5); edycja przychodów nierozliczonych
miesięcy i utworzenie poprzedniego miesiąca (P6); usunięcie wszystkich
przychodów usuwa nierozliczony miesiąc (P7, 2026-10-20); prawdziwe dane
tylko w wersji prywatnej uruchamianej lokalnie, publicznie demo
z piaskownicą dla każdego odwiedzającego (P8, 2026-10-21).

**Założenia (zaproponowane przez agenta, zaakceptowane razem ze specyfikacją):**
- Z1: brak publicznej rejestracji, konto tworzone przy pierwszym
  uruchomieniu wersji prywatnej, reset hasła bez e-maila (operacja
  administracyjna).
- Z2: miesiąc powstaje przy pierwszym przychodzie i dostaje plan podziału
  obowiązujący w tej chwili.
- Z3: rozliczenie możliwe od ostatniego dnia miesiąca.
- Z4: przychody zawsze w PLN; EUR dotyczy tylko źródeł.
- Z5: zaokrąglenie w dół na poziomie puli i celu (rozdz. 6).
- Z6: domyślny motyw zgodny z ustawieniem systemu.

**Założenia wersji demo (zaproponowane przez agenta, zaakceptowane przez
właściciela produktu razem z P8, 2026-10-21):**
- Z7: piaskownica żyje 24 godziny; „Wyloguj” kończy ją od razu.
- Z8: limity 10 piaskownic na godzinę z jednego adresu IP i 500 aktywnych
  naraz (ochrona darmowej bazy).
- Z9: wersja prywatna zachowuje logowanie hasłem (ochrona przed innymi
  użytkownikami tego samego komputera).

**Otwarte pytania:** brak.

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
4. **Rozliczenie zgodne z planem:** po „Tak, plan zrealizowany” i „Zatwierdź
   rozliczenie” wartości źródeł rosną
   o zaplanowane kwoty, miesiąc ma status rozliczony i nie da się go edytować.
5. **Rozliczenie częściowe:** wpisanie 500 zł zamiast 980 zł przy Poduszce
   zwiększa jej źródło o 500 zł, a historia pokazuje plan 980,00 i wykonanie 500,00.
6. **Źródło w EUR:** przy kursie 4,3000 i celu 220,50 zł pole rozliczenia jest
   wstępnie wypełnione kwotą 51,28 € (51,279… zaokrąglone do najbliższego
   centa). Źródło EUR o wartości 1 000,00 € po zatwierdzeniu ma 1 051,28 €,
   a jego udział w majątku to 4 520,50 zł.
7. **Zaległy miesiąc:** gdy wrzesień nie jest rozliczony, w październiku widać
   pigułkę „Wrzesień 2026 czeka na rozliczenie”, a po wpisaniu przychodu
   9 800,00 zł plan października wylicza te same kwoty co w scenariuszu 1.
8. **Zmiana planu:** zmiana procentów w październiku nie zmienia planu
   istniejącego miesiąca października ani historii; dotyczy listopada.
9. **Wypłata:** ręczne zmniejszenie wartości źródła zmniejsza sumę majątku.
10. **Cel osiągnięty:** cel z kwotą docelową 5 000 zł po osiągnięciu tej kwoty
    pokazuje „osiągnięty”, a kolejny miesiąc nadal planuje na niego wpłatę.
11. **Postęp celu:** cel z kwotą startową 2 000 zł i rozliczonymi wpłatami
    588 zł i 512 zł pokazuje 3 100 / 5 000 zł; ręczne zmniejszenie wartości
    połączonego źródła nie zmienia tego postępu.
12. **Motywy i telefon:** wszystkie ekrany działają w obu motywach i przy
    szerokości 360 px bez przewijania w poziomie.
13. **Dostęp:** bez zalogowania (w demo: bez aktywnej piaskownicy) żaden
    ekran ani endpoint nie zwraca danych.
14. **Reszta z zaokrągleń:** przy przychodzie 9 650,00 zł i planie ze scenariusza 1
    ekran pokazuje oszczędności 1 930,00 zł, inwestycje 1 447,49 zł, do wydania
    6 272,51 zł.
15. **Podwójne rozliczenie:** drugie zatwierdzenie tego samego miesiąca jest
    odrzucone, a wartości źródeł zmieniają się tylko raz.
16. **Archiwizacja:** źródła o wartości 500,00 zł nie da się zarchiwizować;
    po zmianie wartości na 0 i odłączeniu od celów archiwizacja się udaje,
    a liczba źródeł na ekranie „Ten miesiąc” spada o 1.
17. **Cel w EUR:** cel z kwotą docelową 2 000,00 €, kwotą startową 500,00 €
    i rozliczoną wpłatą 51,28 € pokazuje postęp 551 / 2 000 €, niezależnie
    od zmiany kursu.
18. **Poprzedni miesiąc:** w październiku, gdy wrzesień nie istnieje,
    użytkownik wpisuje przychód za wrzesień; wrzesień powstaje z bieżącym
    planem i pojawia się pigułka „Wrzesień 2026 czeka na rozliczenie”.
    Utworzenie sierpnia nie jest możliwe.
19. **Wejście do demo:** po kliknięciu „Wypróbuj wersję demo” widać ekran
    „Ten miesiąc” z przychodami, planem, pigułką zaległego miesiąca
    i banerem demo; Majątek, Plan podziału i Historia też mają dane.
    Drugi oglądający w innej przeglądarce dostaje inne dane, a zmiana
    wprowadzona przez pierwszego (np. nowy przychód) nie jest u niego widoczna.
20. **Wygaśnięcie demo:** po 24 godzinach od wejścia (albo po „Wyloguj”)
    odświeżenie strony pokazuje ekran startowy demo, a dane piaskownicy
    zostają usunięte przy kolejnym wejściu do demo kogokolwiek.
21. **Separacja wersji:** wersja demo nie ma formularza logowania, a próba
    logowania hasłem wysłana bezpośrednio do serwera jest odrzucona;
    wersja prywatna nie ma przycisku „Wypróbuj wersję demo” i nie tworzy
    piaskownic; wersja prywatna jest niedostępna z innego komputera w tej
    samej sieci.
