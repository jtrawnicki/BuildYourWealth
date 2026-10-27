# BuildYourWealth: specyfikacja

Status: **MVP zaakceptowane przez właściciela produktu, po review etapu B
(2026-10-19)**; zmiana koncepcji wdrożenia (wersja prywatna i demo, P8)
z 2026-10-21. **Etap 2** (kurs NBP, powiadomienia e-mail, historia majątku,
termin celu; rozdz. 5.9–5.12, decyzje P9–P20) z 2026-10-27: **projekt po
wywiadzie z właścicielem, przed review etapu B**. Dokument powstał na
podstawie wywiadów z właścicielem produktu. Proces pracy opisuje
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
| **Kurs EUR** | Średni kurs EUR→PLN z tabeli A Narodowego Banku Polskiego (NBP), pobierany automatycznie. Gdy kursu z NBP nie ma, aplikacja używa kursu zapasowego wpisanego ręcznie (5.9). |
| **Historia wartości** | Zapis każdej zmiany wartości źródła z datą; z niej powstaje wykres majątku (5.11). |
| **Termin celu** | Miesiąc i rok, do kiedy cel z kwotą docelową ma być osiągnięty (opcjonalny). |
| **Prognoza celu** | Szacowany miesiąc osiągnięcia kwoty docelowej przy dotychczasowym tempie wpłat (5.12). |
| **Powiadomienie** | Mail wysyłany przez wersję prywatną przy określonych zdarzeniach (5.10). |

## 5. Funkcje

Rozdziały 5.1–5.8 opisują MVP, 5.9–5.12 Etap 2. Zmiany Etapu 2 w rozdziałach
MVP są wpisane bezpośrednio w ich treść.

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
- Kurs EUR→PLN pochodzi z NBP, a kurs zapasowy wpisuje użytkownik (5.9).
- Widok pokazuje sumę majątku w PLN, osobno sumę oszczędności i inwestycji,
  oraz wartość każdego źródła w jego walucie (dla EUR także w PLN).
- Nad listą źródeł jest wykres wartości majątku w czasie (5.11). Każda zmiana
  wartości źródła trafia do historii wartości.
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
- Cel z kwotą docelową może mieć opcjonalny termin (miesiąc i rok) i pokazuje
  prognozę (5.12). Termin, podobnie jak nazwa i kwoty, jest bieżącym atrybutem
  celu, nie częścią migawki planu.
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
  procent, kwota, pasek postępu celu, jeśli ma kwotę docelową, oraz krótka
  prognoza celu z 5.12).
- Kwota puli pokazywana wszędzie (karty, legenda, zdanie „odkładasz X”,
  Historia) to suma kwot jej celów (reguła 6.4).
- Dla celu połączonego ze źródłem w EUR kwota jest podana w PLN oraz
  orientacyjnie w EUR według bieżącego kursu (reguły 6.8 i 6.10). Gdy nie ma
  ani kursu NBP, ani kursu zapasowego, zamiast kwoty w EUR jest link
  „Ustaw kurs EUR”.
- Ekran pokazuje sumę majątku i link do sekcji Majątek.

### 5.5 Rozliczenie miesiąca
- Miesiąc można rozliczyć od jego ostatniego dnia (strefa czasowa
  Europe/Warsaw).
- Każdy nierozliczony miesiąc z przeszłości jest widoczny jako osobna pigułka
  „Wrzesień 2026 czeka na rozliczenie” z linkiem „Rozlicz”, od najstarszego.
  Wersja prywatna przypomina o rozliczeniu także mailem (5.10).
- Ekran rozliczenia (makieta B2): użytkownik wybiera jedną z dwóch opcji,
  a potem zatwierdza przyciskiem „Zatwierdź rozliczenie”.
  - „Tak, plan zrealizowany”: faktyczne kwoty = zaplanowane.
  - „Nie, wpiszę faktyczne kwoty”: pole przy każdym celu, wstępnie wypełnione
    kwotą planu; dozwolone 0.
  - Dla źródła w EUR kwota jest zapisywana w EUR. W obu opcjach jest to kwota
    planu przeliczona po kursie rozliczenia (reguły 6.8 i 6.10); w trybie
    ręcznym można ją poprawić. Ekran pokazuje kurs rozliczenia z datą
    i pochodzeniem, np. „Kurs 4,2650 zł (NBP, 30.10.2026)”. Gdy kursu
    rozliczenia nie da się ustalić, rozliczenia nie da się zatwierdzić,
    a ekran prosi o kurs zapasowy.
- Po zatwierdzeniu faktyczne kwoty są dodawane do bieżącej wartości
  połączonych źródeł, kurs użyty przy rozliczeniu jest zapisywany razem
  z datą i pochodzeniem (NBP albo zapasowy), a miesiąc staje się rozliczony
  i tylko do odczytu.
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
  rozliczeniu, więc późniejsza zmiana kursu nie zmienia historii. Przy
  rozliczonym miesiącu z celem EUR widać kurs rozliczenia z datą
  i pochodzeniem (NBP albo zapasowy).

### 5.7 Ustawienia
- Kurs EUR: bieżący kurs NBP z datą tabeli i kurs zapasowy (5.9).
- Powiadomienia e-mail (5.10).
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
  - wartości źródeł i postępy celów zgodne z rozliczeniami (reguły rozdz. 6);
  - historia wartości z ostatnich 12 miesięcy, zgodna z rozliczeniami
    i z co najmniej jedną ręczną zmianą wyceny, więc wykres (5.11) ma dane;
  - wśród celów z kwotą docelową: co najmniej jeden z terminem, w którym
    „zdążysz”, i jeden zagrożony (5.12);
  - kurs zapasowy; kursy rozliczeń przykładowych miesięcy są wygenerowane,
    nie są prawdziwymi kursami NBP. Bieżący kurs pochodzi z NBP jak
    w wersji prywatnej.
- **Powiadomienia:** demo nie wysyła żadnych maili. Ustawienia pokazują
  podgląd maili, które wersja prywatna wysłałaby dla danych piaskownicy
  (5.10).
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

### 5.9 Kurs EUR z NBP
- Aplikacja sama pobiera średni kurs EUR z tabeli A NBP. NBP publikuje
  tabelę w dni robocze; w weekendy i święta obowiązuje ostatnia
  opublikowana.
- **Bieżący kurs** to najnowsza pobrana tabela NBP. Służy do orientacyjnych
  kwot w EUR na „Ten miesiąc”, przeliczenia źródeł EUR na Majątku, bieżącego
  punktu wykresu i prognoz celów EUR.
- **Kurs rozliczenia** miesiąca to kurs z jego ostatniego dnia (reguła 6.10),
  niezależnie od dnia, w którym użytkownik rozlicza.
- Pobieranie nie wymaga żadnej akcji użytkownika. Gdy aplikacja potrzebuje
  kursu, sprawdza w NBP nowszą tabelę (najwyżej raz na godzinę). Brak
  odpowiedzi NBP nie blokuje ekranu: aplikacja używa ostatnio pobranego
  kursu i pokazuje jego datę.
- Ustawienia pokazują bieżący kurs z pochodzeniem i datą, np. „4,2731 zł ·
  NBP, tabela z 27.10.2026”. Gdy najnowszy pobrany kurs jest starszy niż
  7 dni, obok jest ostrzeżenie „Nie udało się pobrać nowszego kursu z NBP”.
- **Kurs zapasowy** (pole w Ustawieniach, dawny kurs ręczny) jest używany
  tylko wtedy, gdy aplikacja nie ma żadnego pasującego kursu z NBP
  (reguła 6.10), np. przy pierwszym uruchomieniu bez internetu. Kurs
  wpisany ręcznie przed Etapem 2 staje się kursem zapasowym. Kurs zapasowy
  w użyciu jest zawsze oznaczony: „4,3000 zł · kurs zapasowy”.
- Majątek przy sumie źródeł EUR podaje użyty kurs z datą.
- Dotyczy tylko EUR. Inne waluty pozostają poza zakresem (rozdz. 9).

### 5.10 Powiadomienia e-mail
- Dotyczy wersji prywatnej. Maile wysyła serwer poczty (SMTP) skonfigurowany
  przez właściciela w pliku konfiguracji wersji prywatnej, domyślnie Gmail
  z hasłem aplikacji. Instrukcja konfiguracji jest w dokumentacji
  uruchomienia.
- **Kiedy aplikacja sprawdza powiadomienia:** przy uruchomieniu wersji
  prywatnej, codziennie przez zadanie w Harmonogramie zadań Windows (działa
  także, gdy aplikacja jest wyłączona; wymaga uruchomionego Dockera) oraz
  zaraz po rozliczeniu miesiąca. Jeśli komputer był wyłączony w dniu
  zdarzenia, mail wychodzi przy najbliższym sprawdzeniu, o ile jest nadal
  aktualny (szczegóły przy każdym zdarzeniu). Każdy mail wychodzi najwyżej
  raz, niezależnie od liczby sprawdzeń.
- **Adresat:** domyślnie e-mail konta; w Ustawieniach można wpisać inny adres.
- **Zdarzenia** (każda grupa włączana osobno w Ustawieniach, domyślnie
  włączone):
  1. **Przychody** — 10. dnia każdego miesiąca mail „Uzupełnij przychody
     z listopada 2026” z listą wpisanych dotąd pozycji przychodu bieżącego
     miesiąca i ich sumą albo informacją, że żadnej jeszcze nie ma. Wysyłany
     zawsze, raz w miesiącu; jeśli 10. dnia nie było sprawdzenia, wychodzi
     przy pierwszym sprawdzeniu po 10. dniu tego samego miesiąca.
     W kolejnym miesiącu już nie.
  2. **Rozliczenie** — od ostatniego dnia miesiąca, który istnieje i nie
     jest rozliczony, mail „Październik 2026 czeka na rozliczenie”. Gdy
     czeka kilka miesięcy, jeden mail wymienia wszystkie, od najstarszego
     („2 miesiące czekają na rozliczenie”). Przypomnienie powtarza się, gdy
     od poprzedniego maila tej grupy minęło co najmniej 7 dni i nadal jakiś
     miesiąc czeka. Po rozliczeniu wszystkich miesięcy maile ustają.
  3. **Cele**:
     - **Cel osiągnięty** — mail „Cel „Wakacje” osiągnięty” po rozliczeniu,
       w którym postęp celu doszedł do kwoty docelowej. Raz dla danej kwoty
       docelowej; po jej zmianie i ponownym osiągnięciu wychodzi nowy mail.
       Nie wychodzi, jeśli to rozliczenie było więcej niż 30 dni temu.
     - **Cel zagrożony** — mail „Cel „Wakacje” jest zagrożony”, gdy cel
       z terminem zmienia status na „zagrożony” (5.12). Treść: postęp,
       termin, prognoza, wymagana wpłata miesięczna i sugerowany procent
       puli. Kolejny mail dla tego celu dopiero po tym, jak cel wróci do
       statusu „zdążysz” (albo straci termin) i znów stanie się zagrożony.
- **Treść maili** jest po polsku, z kwotami w formacie z rozdz. 8 (P15),
  i zawiera adres wersji prywatnej (`http://127.0.0.1:4000`) z linkiem do
  właściwego ekranu.
- **Ustawienia → Powiadomienia:** adres e-mail, trzy przełączniki grup,
  przycisk „Wyślij testowy mail” (temat „Testowy mail z BuildYourWealth”)
  i lista 10 ostatnich maili (data, temat, wysłany albo błąd).
- **Brak konfiguracji SMTP:** sekcja pokazuje „Wysyłka maili nie jest
  skonfigurowana” z odnośnikiem do instrukcji; nic nie jest wysyłane, a brak
  konfiguracji nie jest błędem aplikacji.
- **Błąd wysyłki** (np. brak internetu, złe hasło): mail nie jest uznany za
  wysłany i aplikacja próbuje ponownie przy kolejnym sprawdzeniu, o ile jest
  nadal aktualny. Lista ostatnich maili pokazuje błąd. Test mail pokazuje
  wynik od razu: „Wysłano testowy mail na …” albo „Nie udało się wysłać:
  <powód>”.
- **Demo:** żadnych maili. Sekcja „Powiadomienia” pokazuje „W wersji demo
  maile nie są wysyłane. Tak wyglądałyby maile dla tych danych:” i podgląd
  tematów oraz treści maili, które byłyby teraz do wysłania.

### 5.11 Historia wartości majątku i wykres
- Od wdrożenia Etapu 2 aplikacja zapisuje każdą zmianę wartości źródła
  z datą i powodem: dodanie źródła, ręczna edycja, rozliczenie miesiąca,
  archiwizacja. W chwili wdrożenia zapisuje stan wszystkich istniejących
  źródeł jako punkt startowy. Historii sprzed wdrożenia nie odtwarza się
  ani nie uzupełnia (P17).
- Ekran Majątek pokazuje nad listą źródeł wykres „Wartość majątku”: jedna
  linia z sumą majątku w PLN na koniec każdego miesiąca (reguła 6.11), od
  miesiąca wdrożenia do bieżącego. Punkt bieżącego miesiąca to stan na
  teraz.
- Zakres: cała historia, bez przełączników zakresu.
- Najechanie albo dotknięcie punktu (także fokus z klawiatury) pokazuje
  miesiąc, kwotę i zmianę względem poprzedniego punktu, np. „Październik
  2026 · 48 230,00 zł · +1 120,00 zł”.
- Dane wykresu są dostępne także jako tabela dla czytników ekranu.
- Gdy jest mniej niż dwa punkty: zamiast wykresu tekst „Wykres pojawi się
  po pierwszym pełnym miesiącu historii.”
- Zmiana bieżącego kursu nie zmienia punktów z poprzednich miesięcy.
- Zapisy historii nie są edytowalne. Korekta wartości źródła to nowa zmiana
  z bieżącą datą.

### 5.12 Termin celu i prognoza
- **Termin:** opcjonalne pole celu w Planie podziału, miesiąc i rok (np.
  „czerwiec 2027”). Wymaga kwoty docelowej. Usunięcie kwoty docelowej
  usuwa termin.
- **Prognoza** dla każdego celu z kwotą docelową, który nie jest osiągnięty
  (reguła 6.12): „Osiągniesz ok. w styczniu 2027”. Gdy średnia wpłata
  wynosi 0: „Przy obecnych wpłatach cel nie zostanie osiągnięty”.
- **Status celu z terminem** (reguła 6.13):
  - „zdążysz” — prognoza nie później niż termin;
  - „zagrożony” — prognoza później niż termin albo brak prognozy;
  - „termin minął” — termin jest wcześniejszy niż pierwszy miesiąc
    prognozy, a cel nie jest osiągnięty.
  Cel osiągnięty pokazuje „osiągnięty”, jak dotąd, bez statusu terminu.
- **„Ten miesiąc”**, przelewy do wykonania: pod paskiem postępu jedna linia,
  np. „Osiągniesz ok. w styczniu 2027” albo „Termin: grudzień 2026 ·
  zagrożony”. Status „zagrożony” prowadzi do Planu podziału.
- **Plan podziału**, przy celu z terminem: wymagana wpłata i sugestia,
  np. „Do grudnia 2026 potrzebujesz 650,00 zł miesięcznie (średnio
  wpłacasz 566,66 zł). Ustaw ok. 33,17% puli Oszczędności (teraz 30,00%).”
  Gdy sugerowany procent przekracza 100%: „Nawet 100% puli nie wystarczy.
  Zwiększ procent puli albo przesuń termin.” Aplikacja niczego nie zmienia
  sama; procenty zmienia użytkownik, z regułami z 5.3.
- Dla celu EUR kwoty prognozy i wymaganej wpłaty są w EUR; sugerowany
  procent liczy się z kwoty przeliczonej na PLN po bieżącym kursie.

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
10. Kursy EUR (5.9). Dzień roboczy NBP to dzień, dla którego NBP opublikował
    tabelę A.
    - `bieżący kurs` = kurs z najnowszej pobranej tabeli NBP; gdy żadnej nie
      ma — kurs zapasowy; gdy i jego brak — kursu nie ma.
    - `kurs na dzień D` = kurs z ostatniej tabeli NBP z datą ≤ D.
    - `kurs rozliczenia` miesiąca M = `kurs na dzień` ostatniego dnia M,
      z tabel dostępnych w chwili rozliczenia (jeśli rozliczenie następuje
      ostatniego dnia M przed publikacją tabeli z tego dnia, liczy się
      poprzednia tabela). Gdy NBP nie odpowiada i aplikacja nie ma zapisanej
      tabeli z ostatnich 7 dni przed końcem M — kurs zapasowy; gdy i jego
      brak — rozliczenia nie da się zatwierdzić.
    - Zapisywany jest kurs, data tabeli i pochodzenie (NBP / zapasowy).
11. Stan majątku na koniec miesiąca M (punkt wykresu, 5.11):
    - wartość źródła = ostatnia zapisana w historii wartość z chwilą ≤ koniec
      M (Europe/Warsaw); źródło bez zapisu do tej chwili ma 0;
    - źródło EUR przeliczone na PLN regułą 8 po `kursie na dzień` ostatniego
      dnia M (reguła 10), zapasowym, gdy go nie ma;
    - punkt bieżącego miesiąca: bieżące wartości źródeł i `bieżący kurs`;
    - suma jak w regule 7.
12. Prognoza celu z kwotą docelową, nieosiągniętego (5.12), w walucie
    źródła celu:
    - `pozostało` = kwota docelowa − postęp (reguła 6);
    - `średnia wpłata` = średnia arytmetyczna faktycznych kwot celu
      z ostatnich (najwyżej) 3 rozliczonych miesięcy, w których cel był
      w migawce planu, zaokrąglona w dół do grosza (centa). Gdy takich
      miesięcy nie ma: kwota celu z najstarszego nierozliczonego miesiąca
      z tym celem (dla celu EUR przeliczona regułą 8 po `bieżącym kursie`),
      a gdy i takiego nie ma — prognozy nie ma;
    - `pierwszy miesiąc wpłaty` P = najstarszy nierozliczony miesiąc
      z tym celem; gdy takiego nie ma — bieżący miesiąc kalendarzowy, jeśli
      nie jest rozliczony, w przeciwnym razie następny;
    - `liczba wpłat` n = `pozostało` ÷ `średnia wpłata`, zaokrąglone w górę;
    - `miesiąc osiągnięcia` = P + (n − 1) miesięcy;
    - `średnia wpłata` = 0 → prognozy nie ma („nie zostanie osiągnięty”).
13. Termin celu (5.12), dla celu nieosiągniętego z terminem T:
    - T wcześniejszy niż P → status „termin minął”, bez wymaganej wpłaty;
    - `liczba wpłat do terminu` k = liczba miesięcy od P do T włącznie;
    - `wymagana wpłata` = `pozostało` ÷ k, zaokrąglone w górę do grosza
      (centa);
    - status „zdążysz”, gdy `miesiąc osiągnięcia` ≤ T, w przeciwnym razie
      (także bez prognozy) „zagrożony”;
    - `średnia kwota bazowa puli` = średnia arytmetyczna kwot bazowych puli
      celu (reguła 2) z ostatnich (najwyżej) 3 rozliczonych miesięcy,
      zaokrąglona w dół do grosza; gdy takich miesięcy nie ma — kwota bazowa
      puli najnowszego istniejącego miesiąca; gdy i jego brak albo kwota
      wynosi 0 — sugestii procentu nie ma;
    - `sugerowany procent celu` = `wymagana wpłata` (w PLN; dla celu EUR
      przeliczona regułą 8 po `bieżącym kursie`) ÷ `średnia kwota bazowa
      puli`, w setnych procenta, zaokrąglony w górę. Powyżej 100,00% —
      komunikat „Nawet 100% puli nie wystarczy…” zamiast procentu.

Przykład: przychód 9 800,00 zł, oszczędności 20%, inwestycje 15% →
oszczędności 1 960,00 zł, inwestycje 1 470,00 zł, do wydania 6 370,00 zł.
Cel 25% inwestycji = 367,50 zł.

Przykład z resztą z zaokrągleń: przychód 9 650,00 zł, inwestycje 15% (cele
60/25/15) → kwota bazowa 1 447,50 zł, cele 868,50 + 361,87 + 217,12, kwota puli
pokazywana 1 447,49 zł, a 0,01 zł przechodzi do „do wydania”.

Przykład prognozy (reguły 12–13): 10 listopada 2026 cel „Wakacje”
(Oszczędności, 30% puli, kwota docelowa 5 000 zł, startowa 2 000 zł) ma
rozliczone wpłaty z sierpnia, września i października: 588,00, 512,00
i 600,00 zł; listopad jest nierozliczony. Przychód każdego z tych miesięcy
9 800,00 zł, Oszczędności 20%. Postęp 3 700,00 zł, `pozostało` 1 300,00 zł,
`średnia wpłata` 566,66 zł (1 700,00 ÷ 3 = 566,666…), P = listopad 2026,
n = 3 (2,29… w górę), prognoza: styczeń 2027. Przy terminie grudzień 2026:
k = 2, `wymagana wpłata` 650,00 zł, status „zagrożony”, `średnia kwota
bazowa puli` 1 960,00 zł, sugerowany procent 33,17% (650 ÷ 1 960 =
33,163…% w górę). Przy terminie marzec 2027: k = 5, `wymagana wpłata`
260,00 zł, status „zdążysz”.

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
| Brak kursu EUR (ani z NBP, ani zapasowego) przy źródle EUR | Aplikacja prosi o kurs zapasowy przed pokazaniem sumy majątku. |
| Dwa cele połączone z tym samym źródłem | Dozwolone. |
| Zmiana kursu EUR | Zmienia tylko bieżące przeliczenia na PLN; wartości w EUR i rozliczone miesiące bez zmian. |
| Brak kursu EUR (ani z NBP, ani zapasowego) przy celu EUR | „Ten miesiąc” pokazuje link „Ustaw kurs EUR” zamiast kwoty w EUR; rozliczenia nie da się zatwierdzić. |
| NBP nie odpowiada | Aplikacja działa na ostatnio pobranym kursie z jego datą (5.9); rozliczenie wg reguły 6.10. Brak internetu nie jest błędem zapisu. |
| Rozliczenie długo po końcu miesiąca | Kurs z ostatniego dnia rozliczanego miesiąca (reguła 6.10), nie z dnia rozliczenia. |
| Termin celu już minął | Status „termin minął”; mail „Cel zagrożony” nie wychodzi. Zapisany termin z przeszłości zostaje, dopóki użytkownik go nie zmieni. |
| Usunięcie celu z planu | Prognoza i powiadomienia o tym celu znikają; wysłane maile zostają na liście ostatnich maili. |
| Dwa sprawdzenia powiadomień naraz (Harmonogram i start aplikacji) | Każdy mail wychodzi najwyżej raz. |
| Grupa powiadomień wyłączona, potem włączona | Po włączeniu wychodzą tylko maile nadal aktualne (np. nierozliczony miesiąc), bez zaległych z okresu wyłączenia. |
| Zmiana adresu e-mail powiadomień | Kolejne maile idą na nowy adres; wysłane wcześniej nie są powtarzane. |
| Archiwizacja źródła | Historia wartości zostaje; źródło ma w niej wartość 0 od chwili archiwizacji. |
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
| Kurs zapasowy EUR | > 0, najwyżej 4 miejsca po przecinku. Puste = brak. | „Wpisz kurs, np. 4,2850” |
| Termin celu | Miesiąc i rok, nie wcześniejszy niż bieżący miesiąc (sprawdzane przy zmianie terminu). | „Wybierz termin od bieżącego miesiąca” |
| Termin celu bez kwoty docelowej | Niedozwolony. | „Termin wymaga kwoty docelowej” |
| Adres e-mail powiadomień | Wymagany, poprawny adres, najwyżej 254 znaki. | „Wpisz adres e-mail, np. jan@example.com” |
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

## 9. Poza zakresem (świadomie odłożone)

Kurs z NBP, powiadomienia e-mail, wykres majątku i termin celu, odłożone
w MVP, są w Etapie 2 (5.9–5.12). Nadal poza zakresem:

1. Konta dla rodziny i znajomych, rejestracja.
2. Eksport danych do CSV.
3. Import danych z obecnego arkusza, uzupełnianie historii wartości wstecz.
4. Śledzenie wydatków.
5. Waluty inne niż PLN i EUR, przychody w EUR.
6. Cel ze stałą kwotą miesięczną wyliczaną z terminu (zamiast procentu).
7. Własna domena dla wersji demo (możliwa w przyszłości, nie wymagana).
8. Dostęp do wersji prywatnej z telefonu lub innego komputera (np. przez
   prywatną sieć VPN między urządzeniami właściciela).
9. Powiadomienia push; maile o kopii zapasowej, miesięcznym podsumowaniu
   i zmianie kursu.
10. Historia kursu EUR (wykres, zmiana od poprzedniego miesiąca), wykres
    oszczędności i inwestycji osobno, wykres pojedynczego źródła, porównanie
    wpłat z wartością.
11. Prognoza całego majątku (np. z założoną stopą zwrotu).

## 10. Ograniczenia

- **Zero kosztów:** hosting, baza danych i domena mieszczą się w darmowych
  planach. Akceptujemy ograniczenia darmowych planów (np. usypianie serwera).
- **Wersja prywatna** (prawdziwe dane): działa wyłącznie na komputerze
  właściciela, uruchamiana przez niego ręcznie, dostępna tylko z tego
  komputera (nie z sieci lokalnej ani z internetu). Dane w lokalnej bazie
  danych, kopia zapasowa ręczna.
- **Wersja demo:** aplikacja webowa dostępna publicznie przez internet,
  HTTPS, wyłącznie z danymi wygenerowanymi (5.8).
- **Połączenia wersji prywatnej z internetem** (Etap 2): tylko dwa,
  wychodzące. API NBP (zapytanie nie zawiera danych użytkownika) oraz serwer
  poczty, przez który maile z kwotami trafiają do skrzynki właściciela
  (P15). Aplikacja nadal nie przyjmuje połączeń z sieci.
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
waluta per źródło z ręcznym kursem (od Etapu 2: kurs NBP, P9–P11);
wpłata na cel procentowa, kwota docelowa tylko do postępu; MVP z celami
i historią, bez wykresu, eksportu i importu;
wariant wizualny B; oba motywy; postęp celu liczony z rozliczonych wpłat
plus kwoty startowej (P1); makiety Rozliczenia i Planu podziału (P2);
kwoty celu w walucie źródła (P3); archiwizacja tylko źródła o wartości 0 (P4);
korekta postępu przez kwotę startową (P5); edycja przychodów nierozliczonych
miesięcy i utworzenie poprzedniego miesiąca (P6); usunięcie wszystkich
przychodów usuwa nierozliczony miesiąc (P7, 2026-10-20); prawdziwe dane
tylko w wersji prywatnej uruchamianej lokalnie, publicznie demo
z piaskownicą dla każdego odwiedzającego (P8, 2026-10-21). Decyzja
„powiadomienie tylko w aplikacji” z MVP zastąpiona przez P13–P16.

**Decyzje Etapu 2 (właściciel produktu, 2026-10-27):**
- P9: kurs EUR automatycznie z tabeli A NBP.
- P10: rozliczenie po kursie z ostatniego dnia rozliczanego miesiąca.
- P11: kurs ręczny zostaje wyłącznie jako zapasowy, gdy NBP nie odpowiada.
- P12: tylko EUR; bez historii kursu w interfejsie.
- P13: powiadomienia mailowe przez dowolny serwer SMTP (domyślnie Gmail),
  sprawdzane codziennie przez Harmonogram zadań Windows, przy starcie
  i po rozliczeniu; zaległe wysyłane przy najbliższym sprawdzeniu.
- P14: zdarzenia: przypomnienie o przychodach 10. dnia (zawsze, za bieżący
  miesiąc), miesiąc do rozliczenia (w dniu końca i co 7 dni), cel
  osiągnięty, cel zagrożony. Adresat: e-mail konta z możliwością zmiany.
- P15: maile zawierają kwoty, choć przechodzą przez serwer poczty.
- P16: demo nie wysyła maili, pokazuje podgląd.
- P17: historia wartości od wdrożenia, bez odtwarzania przeszłości; wykres
  sumy majątku na ekranie Majątek, punkt na koniec miesiąca, cała historia;
  źródła EUR po kursie NBP z końca danego miesiąca.
- P18: termin celu jako miesiąc i rok; aplikacja pokazuje wymaganą wpłatę
  i sugeruje procent, niczego nie zmienia sama.
- P19: prognoza ze średniej faktycznych wpłat z 3 ostatnich rozliczonych
  miesięcy, także dla celów bez terminu.
- P20: nowe elementy interfejsu w kierunku wizualnym „Portfel” z odświeżenia
  wyglądu realizowanego osobno; rozdz. 8 opisuje obowiązujący kierunek.

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

**Założenia Etapu 2 (zaproponowane przez agenta, do akceptacji w review):**
- Z10: kurs zapasowy jest używany tylko przy braku pasującego kursu NBP;
  do rozliczenia wystarcza tabela NBP z ostatnich 7 dni przed końcem
  miesiąca (reguła 6.10).
- Z11: nowej tabeli NBP aplikacja szuka najwyżej raz na godzinę; ostrzeżenie
  o nieaktualnym kursie po 7 dniach.
- Z12: mail „cel osiągnięty” nie wychodzi, jeśli rozliczenie, po którym cel
  został osiągnięty, było ponad 30 dni temu (np. świeżo skonfigurowany SMTP
  nie wysyła starych wiadomości).
- Z13: grupy powiadomień domyślnie włączone; po ponownym włączeniu grupy nie
  ma zaległych maili z okresu wyłączenia.
- Z14: pierwszy miesiąc prognozy to najstarszy nierozliczony miesiąc z celem
  (reguła 6.12), bo jego wpłata jeszcze nie jest w postępie.
- Z15: przy braku rozliczeń z celem prognoza bierze kwotę z planu
  najstarszego nierozliczonego miesiąca.
- Z16: w demo kursy rozliczeń przykładowych miesięcy są wygenerowane, bieżący
  kurs pochodzi z NBP.

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

### Scenariusze Etapu 2

22. **Bieżący kurs NBP:** gdy najnowsza tabela NBP jest z 27.10.2026
    z kursem 4,2731, Ustawienia pokazują „4,2731 zł · NBP, tabela
    z 27.10.2026”, a cel 220,50 zł ze źródłem EUR na „Ten miesiąc” ma
    drugą linię „≈ 51,60 €”.
23. **Kurs rozliczenia:** NBP ma tabele z 30.10.2026 (4,2650) i z 04.11.2026
    (4,3000). Rozliczenie października wykonane 5.11.2026 pokazuje „Kurs
    4,2650 zł (NBP, 30.10.2026)”, pole celu 220,50 zł jest wstępnie
    wypełnione kwotą 51,70 €, a źródło EUR o wartości 1 000,00 € po
    zatwierdzeniu ma 1 051,70 €. Historia października pokazuje kurs
    4,2650 z datą 30.10.2026. Majątek po bieżącym kursie 4,3000 liczy to
    źródło jako 4 522,31 zł.
24. **Kurs zapasowy:** NBP nie odpowiada, a aplikacja nie ma tabel z 24–31.10.
    Przy kursie zapasowym 4,3000 ekran rozliczenia października pokazuje
    „Kurs 4,3000 zł · kurs zapasowy” i 51,28 € dla celu 220,50 zł, a Historia
    zapisuje pochodzenie „zapasowy”. Bez kursu zapasowego rozliczenia nie da
    się zatwierdzić, a ekran prosi o kurs zapasowy.
25. **Stan na koniec miesiąca:** źródło PLN o wartości 10 000,00 zł zmienione
    ręcznie 5.11.2026 na 10 500,00 zł i powiększone rozliczeniem 20.11.2026
    o 588,00 zł oraz źródło EUR 1 000,00 € bez zmian, przy tabeli NBP
    z 30.11.2026 (4,2500), dają punkt wykresu „Listopad 2026 · 15 338,00 zł”.
    Zmiana bieżącego kursu i edycja wartości źródła w grudniu nie zmieniają
    tego punktu.
26. **Pusty wykres:** w miesiącu wdrożenia Etapu 2 Majątek pokazuje „Wykres
    pojawi się po pierwszym pełnym miesiącu historii.”; w następnym miesiącu
    wykres ma dwa punkty (koniec miesiąca wdrożenia i stan bieżący).
27. **Prognoza z terminem:** dla danych z przykładu prognozy (rozdz. 6) Plan
    podziału przy terminie grudzień 2026 pokazuje „Do grudnia 2026
    potrzebujesz 650,00 zł miesięcznie (średnio wpłacasz 566,66 zł). Ustaw
    ok. 33,17% puli Oszczędności (teraz 30,00%).”, a „Ten miesiąc” pokazuje
    „Termin: grudzień 2026 · zagrożony”. Po zmianie terminu na marzec 2027
    status to „zdążysz”. Procenty planu nie zmieniają się same.
28. **Prognoza bez terminu:** ten sam cel bez terminu pokazuje „Osiągniesz ok.
    w styczniu 2027”. Gdy faktyczne wpłaty z trzech ostatnich rozliczonych
    miesięcy wynoszą 0, pokazuje „Przy obecnych wpłatach cel nie zostanie
    osiągnięty”.
29. **Mail o przychodach:** sprawdzenie 10.11.2026 wysyła „Uzupełnij przychody
    z listopada 2026” z listą wpisanych pozycji; drugie sprawdzenie tego
    samego albo następnego dnia nie wysyła nic. Gdy pierwsze sprawdzenie
    w listopadzie następuje 12.11, mail wychodzi 12.11. Sprawdzenie
    1.12.2026 nie wysyła maila za listopad.
30. **Mail o rozliczeniu:** październik 2026 z przychodem, nierozliczony:
    sprawdzenie 31.10 wysyła „Październik 2026 czeka na rozliczenie”,
    sprawdzenia 1–6.11 nie wysyłają nic, sprawdzenie 7.11 wysyła
    przypomnienie. Po rozliczeniu 8.11 kolejne sprawdzenia nie wysyłają nic.
    Gdy czekają wrzesień i październik, jeden mail wymienia oba, od
    najstarszego.
31. **Mail o osiągniętym celu:** rozliczenie, po którym postęp celu z kwotą
    docelową 5 000 zł wynosi co najmniej 5 000 zł, wysyła jeden mail „Cel
    „Wakacje” osiągnięty”; kolejne rozliczenia nie wysyłają go ponownie. Po
    zmianie kwoty docelowej na 8 000 zł i jej osiągnięciu wychodzi nowy mail.
32. **Mail o zagrożonym celu:** gdy cel ze scen. 27 staje się zagrożony,
    wychodzi jeden mail z kwotą 650,00 zł i sugestią 33,17%; kolejne
    sprawdzenia go nie powtarzają. Po zmianie terminu na marzec 2027
    („zdążysz”) i powrocie do grudnia 2026 wychodzi nowy mail.
33. **Wysyłka i jej błędy:** bez konfiguracji SMTP Ustawienia pokazują
    „Wysyłka maili nie jest skonfigurowana” i nic nie jest wysyłane. Przy
    błędnym haśle SMTP „Wyślij testowy mail” pokazuje „Nie udało się wysłać:
    …”, a mail zdarzenia, którego nie udało się wysłać, wychodzi przy
    kolejnym sprawdzeniu po naprawie konfiguracji, jeśli jest nadal
    aktualny. Wyłączona grupa nie wysyła maili.
34. **Demo w Etapie 2:** piaskownica ma wykres z historią 12 miesięcy, cel
    z terminem „zdążysz” i cel „zagrożony”; Ustawienia pokazują podgląd
    maili z informacją, że demo ich nie wysyła; żadna akcja w trybie demo
    nie łączy się z serwerem poczty.
