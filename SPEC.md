# BuildYourWealth: specyfikacja

Status: **MVP zaakceptowane przez właściciela produktu, po review etapu B
(2026-10-19)**; zmiana koncepcji wdrożenia (wersja prywatna i demo, P8)
z 2026-10-21. **Etap 2** (kurs NBP, powiadomienia e-mail, historia majątku,
termin celu; rozdz. 5.9–5.12, decyzje P9–P23) z 2026-10-27: **po
niezależnym review etapu B i rozstrzygnięciach właściciela (2026-10-27,
[`docs/reviews/spec-review-etap2-B.md`](docs/reviews/spec-review-etap2-B.md))**. Dokument powstał na
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
  - Rozliczenie w ostatnim dniu miesiąca przed publikacją tabeli NBP z tego
    dnia używa poprzedniej tabeli; ekran pokazuje jej datę (reguła 6.10,
    P10).
  - Jeśli między otwarciem ekranu a zatwierdzeniem kurs rozliczenia się
    zmieni (np. pojawi się nowa tabela NBP), zatwierdzenie jest odrzucone
    komunikatem „Kurs rozliczenia się zmienił. Sprawdź kwoty i zatwierdź
    ponownie.”, a ekran pokazuje nowy kurs i przeliczone kwoty.
  - Miesiąc bez celu ze źródłem EUR nie potrzebuje kursu i go nie zapisuje.
- Po zatwierdzeniu faktyczne kwoty są dodawane do bieżącej wartości
  połączonych źródeł, kurs użyty przy rozliczeniu jest zapisywany razem
  z datą tabeli i pochodzeniem (NBP albo zapasowy), a miesiąc staje się
  rozliczony i tylko do odczytu.
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
  i pochodzeniem, np. „Kurs 4,2650 zł (NBP, 30.10.2026)” albo „Kurs
  4,3000 zł · kurs zapasowy”. Miesiące rozliczone przed Etapem 2 pokazują
  „Kurs 4,3000 zł (ręczny, sprzed Etapu 2)”, bez daty tabeli.

### 5.7 Ustawienia
- Kurs EUR: bieżący kurs NBP z datą tabeli i kurs zapasowy (5.9).
- Powiadomienia e-mail (5.10).
- Motyw: jasny, ciemny, systemowy (domyślnie systemowy). Wybór jest zapamiętany
  w przeglądarce. Przycisk motywu w nagłówku ustawia motyw przeciwny do
  widocznego; powrót do „systemowy” jest tylko w Ustawieniach.
- Wylogowanie.

### 5.8 Wersja demo
Publiczna wersja aplikacji do pokazywania efektów pracy. Działa tak samo jak
wersja prywatna (5.2–5.7 i 5.9–5.12, bez wysyłki maili z 5.10), ale zawiera wyłącznie dane wygenerowane i nigdy
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
  - kurs zapasowy; kursy rozliczeń przykładowych miesięcy są wygenerowane
    i oznaczone jako kurs zapasowy, nigdy jako NBP. Bieżący kurs i kursy
    z końców miesięcy dla wykresu pochodzą z NBP jak w wersji prywatnej
    (reguły 6.10–6.11), a gdy ich brak — z kursu zapasowego;
  - rozliczone miesiące mają daty rozliczenia z pierwszych dni następnego
    miesiąca, nie dzień wejścia do demo.
- **Powiadomienia:** demo nie wysyła żadnych maili. Ustawienia pokazują
  wyłącznie podgląd maili, które wersja prywatna wysłałaby teraz dla danych
  piaskownicy, bez pola adresu, przełączników i testowego maila (5.10).
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
  tabelę w dni robocze (ok. południa); w weekendy i święta obowiązuje
  ostatnia opublikowana.
- **Bieżący kurs** to najnowsza pobrana tabela NBP. Służy do orientacyjnych
  kwot w EUR na „Ten miesiąc”, przeliczenia źródeł EUR na Majątku, bieżącego
  punktu wykresu i prognoz celów EUR.
- **Kurs rozliczenia** miesiąca to kurs z jego ostatniego dnia (reguła 6.10),
  niezależnie od dnia, w którym użytkownik rozlicza.
- Pobieranie nie wymaga żadnej akcji użytkownika. Gdy aplikacja potrzebuje
  kursu (bieżącego, do rozliczenia albo z końca miesiąca do wykresu),
  sprawdza w NBP brakujące tabele (najwyżej raz na godzinę). Brak odpowiedzi
  NBP nie blokuje ekranu: aplikacja używa ostatnio pobranego kursu i pokazuje
  jego datę.
- Ustawienia pokazują bieżący kurs z pochodzeniem i datą, np. „4,2731 zł ·
  NBP, tabela z 27.10.2026”. Gdy najnowszy pobrany kurs jest starszy niż
  7 dni, obok jest ostrzeżenie „Nie udało się pobrać nowszego kursu z NBP”.
- **Kurs zapasowy** (pole w Ustawieniach, dawny kurs ręczny) jest używany
  tylko wtedy, gdy aplikacja nie ma pasującego kursu z NBP (reguła 6.10),
  np. przy pierwszym uruchomieniu bez internetu. Kurs wpisany ręcznie przed
  Etapem 2 staje się kursem zapasowym. Kurs zapasowy w użyciu jest zawsze
  oznaczony: „4,3000 zł · kurs zapasowy”.
- Majątek przy sumie źródeł EUR podaje użyty kurs z datą.
- Dotyczy tylko EUR. Inne waluty pozostają poza zakresem (rozdz. 9).

### 5.10 Powiadomienia e-mail
- Dotyczy wersji prywatnej. Maile wysyła serwer poczty (SMTP) skonfigurowany
  przez właściciela w pliku konfiguracji wersji prywatnej, domyślnie Gmail
  z hasłem aplikacji, zawsze przez połączenie szyfrowane. Instrukcja
  konfiguracji jest w dokumentacji uruchomienia.
- **Kiedy aplikacja sprawdza powiadomienia:**
  - przy uruchomieniu wersji prywatnej;
  - codziennie przez zadanie w Harmonogramie zadań Windows, także po
    zalogowaniu, gdy komputer był wyłączony o zaplanowanej porze; działa przy
    wyłączonej aplikacji, ale wymaga Dockera uruchamianego automatycznie przy
    logowaniu (P21);
  - zaraz po rozliczeniu miesiąca;
  - zaraz po zapisie Planu podziału albo celu (status terminu celu).
- **Mail jest wysłany**, gdy serwer SMTP go przyjął. Każdy mail jest
  wysyłany najwyżej raz, niezależnie od liczby sprawdzeń.
- **Adresat:** domyślnie e-mail konta; w Ustawieniach można wpisać inny adres.
- **Zdarzenia** w trzech grupach, każda włączana osobno w Ustawieniach
  (domyślnie włączone). Mail wychodzi przy pierwszym sprawdzeniu, w którym
  spełniony jest warunek „Kiedy”, o ile jest nadal aktualny:

  | Grupa | Mail (temat) | Kiedy | Aktualny |
  | --- | --- | --- | --- |
  | Przychody | „Uzupełnij przychody z listopada 2026” | od 10. dnia miesiąca, raz w miesiącu | do ostatniego dnia tego miesiąca |
  | Rozliczenie | „Październik 2026 czeka na rozliczenie” albo „2 miesiące czekają na rozliczenie” | gdy pojawia się nowy miesiąc do rozliczenia (od jego ostatniego dnia) albo minęło co najmniej 7 dni kalendarzowych od dnia ostatniego wysłanego maila tej grupy | dopóki jakiś miesiąc czeka na rozliczenie |
  | Cele | „Cel „Wakacje” osiągnięty” | po rozliczeniu, w którym postęp doszedł do kwoty docelowej | do 30 dni od tego rozliczenia |
  | Cele | „Cel „Wakacje” jest zagrożony” | gdy status terminu celu staje się „zagrożony” (5.12) | dopóki status jest „zagrożony” |

  - **Przychody:** wysyłany zawsze, także gdy przychody są już wpisane.
    Treść: lista wpisanych dotąd pozycji przychodu bieżącego miesiąca i ich
    suma albo informacja, że żadnej jeszcze nie ma.
  - **Rozliczenie:** jeden mail wymienia wszystkie czekające miesiące, od
    najstarszego; liczba w temacie z odmianą („2 miesiące czekają”,
    „5 miesięcy czeka”). Nowy miesiąc do rozliczenia daje mail od razu,
    nawet gdy przypomnienie wyszło niedawno; 7 dni liczy się wtedy od nowa.
    Dni liczone w strefie Europe/Warsaw, niezależnie od godziny.
  - **Cel osiągnięty:** raz dla danej kwoty docelowej; po jej zmianie
    i ponownym osiągnięciu przy rozliczeniu wychodzi nowy mail. Obniżenie
    kwoty docelowej do postępu lub poniżej (bez rozliczenia) nie wysyła
    maila.
  - **Cel zagrożony:** status jest oceniany przy każdym sprawdzeniu, także
    po zapisie planu lub celu. Pierwsza ocena „zagrożony” (np. zaraz po
    ustawieniu terminu) też jest zmianą statusu. Kolejny mail dla tego celu
    wychodzi dopiero, gdy status przestał być „zagrożony” (dowolny inny
    status albo brak terminu) i znów nim jest. Treść: postęp, termin,
    prognoza i teksty z Planu podziału (wymagana wpłata, sugestia procentu
    albo komunikat, gdy sugestii nie ma).
- **Ponowne próby:** mail niewysłany z powodu błędu, wyłączonej grupy albo
  braku konfiguracji SMTP wychodzi przy najbliższym sprawdzeniu, w którym
  jest nadal aktualny (tabela wyżej). Np. grupa „Przychody” włączona 15.11
  wysyła mail za listopad; włączona 1.12 — dopiero 10.12 za grudzień.
- **Treść maili:** zwykły tekst (bez HTML), po polsku, z kwotami
  w formacie z rozdz. 8 (P15), z adresem wersji prywatnej
  (`http://127.0.0.1:4000`) i linkiem do właściwego ekranu.
- **Ustawienia → Powiadomienia:** adres e-mail, trzy przełączniki grup,
  przycisk „Wyślij testowy mail” (temat „Testowy mail z BuildYourWealth”)
  i lista 10 ostatnich maili, także testowych: data, temat i ostatni stan
  (wysłany, błąd z powodem, oczekuje).
- **Brak konfiguracji SMTP:** sekcja pokazuje „Wysyłka maili nie jest
  skonfigurowana” z odnośnikiem do instrukcji; nic nie jest wysyłane, a brak
  konfiguracji nie jest błędem aplikacji.
- **Błąd wysyłki** (np. brak internetu, złe hasło): mail nie jest uznany za
  wysłany; lista ostatnich maili pokazuje błąd. Test mail pokazuje wynik od
  razu: „Wysłano testowy mail na …” albo „Nie udało się wysłać: <powód>”.
- **Demo:** żadnych maili. Sekcja „Powiadomienia” pokazuje tylko „W wersji
  demo maile nie są wysyłane. Tak wyglądałyby maile dla tych danych:”
  i podgląd tematów oraz treści maili, które byłyby teraz aktualne.

### 5.11 Historia wartości majątku i wykres
- Od wdrożenia zapisu historii aplikacja zapisuje każdą zmianę wartości
  źródła z datą, powodem i walutą źródła w tej chwili: dodanie źródła, ręczna
  edycja, rozliczenie miesiąca, archiwizacja. W chwili wdrożenia zapisuje
  stan wszystkich istniejących źródeł jako punkt startowy. Historii sprzed
  wdrożenia nie odtwarza się ani nie uzupełnia (P17).
- Ekran Majątek pokazuje nad listą źródeł wykres „Wartość majątku”: jedna
  linia z sumą majątku w PLN na koniec każdego miesiąca (reguła 6.11), od
  miesiąca wdrożenia do bieżącego. Punkt bieżącego miesiąca to stan na
  teraz. Wygląd: rozdz. 8.1.
- Zakres: cała historia, bez przełączników zakresu.
- Najechanie albo dotknięcie punktu (także fokus z klawiatury) pokazuje
  miesiąc, kwotę i zmianę względem poprzedniego punktu, np. „Październik
  2026 · 48 230,00 zł · +1 120,00 zł”; pierwszy punkt bez zmiany.
- Dane wykresu są dostępne także jako tabela dla czytników ekranu.
- Gdy jest mniej niż dwa punkty (miesiąc wdrożenia): zamiast wykresu tekst
  „Wykres pojawi się w przyszłym miesiącu.”
- Zmiana bieżącego kursu ani zmiana waluty źródła nie zmienia punktów
  z poprzednich miesięcy. Punkt policzony po kursie zapasowym (brak tabeli
  NBP) może się zmienić, gdy aplikacja pobierze brakującą tabelę.
- Gdy źródło EUR nie ma żadnego kursu (ani NBP, ani zapasowego), zamiast
  wykresu jest prośba o kurs zapasowy, jak przy sumie majątku.
- Zapisy historii nie są edytowalne. Korekta wartości źródła to nowa zmiana
  z bieżącą datą.

### 5.12 Termin celu i prognoza
- **Termin:** opcjonalne pole celu w Planie podziału, miesiąc i rok (np.
  „czerwiec 2027”). Wymaga kwoty docelowej. Usunięcie kwoty docelowej
  usuwa termin. Walidacja: rozdz. 7.1.
- **Prognoza** dla każdego celu z kwotą docelową, który nie jest osiągnięty
  (reguła 6.12), ma jeden z trzech wyników:
  - „Osiągniesz ok. w styczniu 2027”;
  - „Przy obecnych wpłatach cel nie zostanie osiągnięty” (średnia wpłata 0);
  - „Prognoza pojawi się, gdy cel trafi do planu miesiąca.” (brak danych:
    cel nie był jeszcze w planie żadnego miesiąca).
- Prognoza opiera się na faktycznych wpłatach (P19), więc zmiana procentu
  celu działa na nią dopiero po rozliczeniu miesięcy z nowym planem. Gdy
  procent celu w bieżącym planie różni się od procentu w najnowszym miesiącu
  z tym celem, pod prognozą jest dopisek „Prognoza uwzględni nowy procent po
  rozliczeniu miesięcy z nowym planem.” (P22).
- **Status celu z terminem** (reguła 6.13): „zdążysz”, „zagrożony”, „termin
  minął” albo „brak danych” (P23). Cel osiągnięty pokazuje „osiągnięty”, jak
  dotąd, bez statusu terminu.
- **„Ten miesiąc”**, przelewy do wykonania: pod paskiem postępu jedna linia:

  | Cel | Linia |
  | --- | --- |
  | bez terminu | wynik prognozy, np. „Osiągniesz ok. w styczniu 2027” |
  | „zdążysz” | „Termin: marzec 2027 · zdążysz (ok. styczeń 2027)” |
  | „zagrożony” | „Termin: grudzień 2026 · zagrożony” (link do Planu podziału) |
  | „termin minął” | „Termin: grudzień 2026 · termin minął” |
  | „brak danych” | „Termin: czerwiec 2027 · brak danych” |

  Dopisek o nowym procencie (wyżej) jest drugą linią.
- **Plan podziału**, przy celu z terminem i statusem innym niż „termin
  minął”: brakująca kwota i wymagana wpłata, np. „Do grudnia 2026 brakuje
  1 300,00 zł. Listopad ma już zaplanowane 588,00 zł, więc w każdym
  kolejnym miesiącu potrzebujesz 712,00 zł (średnio wpłacasz 566,66 zł).”
  Gdy średnia pochodzi z planu (reguła 6.12), zamiast „średnio wpłacasz”
  jest „planujesz”. Bez istniejących miesięcy z celem zdanie o zaplanowanej
  kwocie jest pominięte.
- Przy statusie „zagrożony” albo „brak danych” pod spodem jest sugestia,
  np. „Ustaw ok. 36,33% puli Oszczędności (teraz 30,00%) i zmniejsz
  pozostałe cele albo zwiększ procent puli.” Zamiast sugestii, zależnie od
  reguły 6.13:
  - „Nawet 100% puli nie wystarczy. Zwiększ procent puli albo przesuń
    termin.”;
  - „Zmiana procentu nie zdąży przed terminem. Przesuń termin albo przy
    rozliczeniu wpisz wyższą faktyczną kwotę.”;
  - „Zaplanowane wpłaty wystarczą do terminu.”;
  - „Ustaw kurs EUR, aby zobaczyć sugestię procentu.” (cel EUR bez kursu).
  Aplikacja niczego nie zmienia sama; procenty zmienia użytkownik,
  z regułami z 5.3.
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
    - `kurs na dzień D` = kurs z ostatniej pobranej tabeli NBP z datą ≤ D.
    - `bieżący kurs` = `kurs na dzień` dzisiejszy; gdy żadnej tabeli nie ma —
      kurs zapasowy; gdy i jego brak — kursu nie ma.
    - `kurs rozliczenia` miesiąca M: D = ostatni dzień M; najnowsza tabela
      z datą od D − 6 do D dostępna w chwili zatwierdzenia (rozliczenie
      w dniu D przed publikacją tabeli z D bierze poprzednią). Gdy takiej
      tabeli nie ma — kurs zapasowy; gdy i jego brak — rozliczenia nie da się
      zatwierdzić. Miesiąc bez celu EUR nie ma kursu rozliczenia.
    - Zapisywany jest kurs, data tabeli (dla NBP) i pochodzenie: NBP,
      zapasowy albo — dla miesięcy rozliczonych przed Etapem 2 — ręczny.
11. Stan majątku na koniec miesiąca M (punkt wykresu, 5.11):
    - wartość źródła = ostatni zapis historii z chwilą ≤ koniec M
      (Europe/Warsaw), w walucie zapisanej razem z nim; źródło bez zapisu do
      tej chwili ma 0;
    - zapis w EUR przeliczony na PLN regułą 8 po `kursie na dzień` ostatniego
      dnia M, a gdy go nie ma — po kursie zapasowym;
    - punkt bieżącego miesiąca: bieżące wartości źródeł i `bieżący kurs`;
    - suma jak w regule 7.
12. Prognoza celu z kwotą docelową, nieosiągniętego (5.12), w walucie
    źródła celu. „Miesiąc z celem” to miesiąc, w którego migawce planu jest
    cel; „ostatnie” miesiące liczy się według miesiąca kalendarzowego, nie
    daty rozliczenia.
    - `pozostało` = kwota docelowa − postęp (reguła 6);
    - `średnia wpłata` = średnia arytmetyczna faktycznych kwot celu
      z ostatnich (najwyżej) 3 rozliczonych miesięcy z celem, zaokrąglona
      w dół do grosza (centa). Gdy takich miesięcy nie ma: kwota celu
      z najstarszego nierozliczonego miesiąca z celem (dla celu EUR
      przeliczona regułą 8 po `bieżącym kursie`), opisywana jako
      „planujesz”. Gdy i takiego nie ma — **brak danych**, prognozy nie ma;
    - `pierwszy miesiąc wpłaty` P = najstarszy nierozliczony miesiąc
      z celem; gdy takiego nie ma — bieżący miesiąc kalendarzowy, jeśli nie
      jest rozliczony, w przeciwnym razie następny;
    - `średnia wpłata` = 0 → prognozy nie ma („nie zostanie osiągnięty”);
    - `liczba wpłat` n = `pozostało` ÷ `średnia wpłata`, zaokrąglone w górę;
    - `miesiąc osiągnięcia` = P + (n − 1) miesięcy.
13. Termin celu (5.12), dla celu nieosiągniętego z terminem T:
    - T wcześniejszy niż P → status „termin minął”, dalszych obliczeń nie ma;
    - brak danych (reguła 12) → status „brak danych”;
    - `miesiąc osiągnięcia` ≤ T → „zdążysz”; w przeciwnym razie (także przy
      średniej 0) → „zagrożony”;
    - `zaplanowane` = suma kwot celu (reguła 3) z istniejących
      nierozliczonych miesięcy od P do T (dla celu EUR przeliczona na EUR
      regułą 8 po `bieżącym kursie`);
    - k = liczba miesięcy od P do T włącznie, które jeszcze nie istnieją;
    - `brakuje` = `pozostało` − `zaplanowane`; gdy ≤ 0 — „Zaplanowane wpłaty
      wystarczą do terminu.”; gdy > 0 i k = 0 — „Zmiana procentu nie zdąży
      przed terminem…”;
    - `wymagana wpłata` = `brakuje` ÷ k, zaokrąglone w górę do grosza
      (centa) — kwota w każdym miesiącu, który jeszcze nie istnieje;
    - `średnia kwota bazowa puli` = średnia arytmetyczna kwot bazowych puli
      celu (reguła 2) z ostatnich (najwyżej) 3 rozliczonych miesięcy,
      zaokrąglona w dół do grosza; gdy takich miesięcy nie ma — kwota bazowa
      puli najnowszego istniejącego miesiąca; gdy i jego brak albo kwota
      wynosi 0 — sugestii procentu nie ma;
    - `sugerowany procent celu` (tylko przy statusie „zagrożony” albo „brak
      danych”) = `wymagana wpłata` (w PLN; dla celu EUR przeliczona regułą 8
      po `bieżącym kursie`, a bez kursu sugestii nie ma) ÷ `średnia kwota
      bazowa puli`, w setnych procenta, zaokrąglony w górę. Powyżej 100,00% —
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
i 600,00 zł. Listopad istnieje (przychód 9 800,00 zł, plan z celem 30%,
kwota celu 588,00 zł) i nie jest rozliczony. Przychód każdego z tych
miesięcy 9 800,00 zł, Oszczędności 20%. Postęp 3 700,00 zł, `pozostało`
1 300,00 zł, `średnia wpłata` 566,66 zł (1 700,00 ÷ 3 = 566,666…), P =
listopad 2026, n = 3 (2,29… w górę), prognoza: styczeń 2027.
Przy terminie grudzień 2026: status „zagrożony”, `zaplanowane` 588,00 zł
(listopad), k = 1 (grudzień), `brakuje` 712,00 zł, `wymagana wpłata`
712,00 zł, `średnia kwota bazowa puli` 1 960,00 zł, sugerowany procent
36,33% (712 ÷ 1 960 = 36,326…% w górę; grudzień przy 36,33% to
712,06 zł). Przy terminie marzec 2027: status „zdążysz”, k = 4 (grudzień–
marzec), `wymagana wpłata` 178,00 zł, bez sugestii procentu.

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
| Grupa powiadomień wyłączona, potem włączona | Po włączeniu wychodzą maile nadal aktualne według tabeli w 5.10 i jeszcze niewysłane (np. przychody za bieżący miesiąc po 10. dniu). |
| Zmiana adresu e-mail powiadomień | Kolejne maile idą na nowy adres; wysłane wcześniej nie są powtarzane. |
| Archiwizacja źródła | Historia wartości zostaje; źródło ma w niej wartość 0 od chwili archiwizacji. |
| Zmiana waluty źródła (dozwolona wg 5.2) | Zapisy historii zachowują walutę z chwili zapisu; punkty z poprzednich miesięcy się nie zmieniają. |
| Kurs rozliczenia zmienia się między otwarciem ekranu a zatwierdzeniem | Zatwierdzenie odrzucone: „Kurs rozliczenia się zmienił. Sprawdź kwoty i zatwierdź ponownie.” (5.5). |
| Rozliczenie miesiąca bez celu EUR | Kurs nie jest potrzebny ani zapisywany; brak NBP i kursu zapasowego nie blokuje rozliczenia. |
| Cel dodany do planu po utworzeniu bieżącego miesiąca | Do czasu pierwszego miesiąca z celem status „brak danych” (jeśli ma termin), bez maila „zagrożony”. |
| Obniżenie kwoty docelowej do postępu lub poniżej | Cel jest osiągnięty, bez maila (mail tylko po rozliczeniu). |
| Cel EUR bez żadnego kursu | Prognoza i wymagana wpłata w EUR działają; zamiast sugestii procentu prośba o kurs (5.12). |
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
| Termin celu | Miesiąc i rok, nie wcześniejszy niż pierwszy miesiąc wpłaty P (reguła 6.12) i nie późniejszy niż grudzień 2099 (sprawdzane przy zmianie terminu). | „Wybierz termin od listopada 2026” (miesiąc P) |
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

### 8.1 Elementy Etapu 2

Kierunek wizualny opisuje rozdz. 8; odświeżenie „Portfel” aktualizuje go
przed zadaniami interfejsu Etapu 2 (P20). Niezależnie od kierunku:

- **Wykres „Wartość majątku”** (Majątek): karta nad listą źródeł z tytułem
  i bieżącą sumą. Linia w kolorze akcentu z punktami na końcach miesięcy,
  oś Y od 0 z trzema poziomymi liniami pomocniczymi i skróconymi etykietami
  („50 tys. zł”), oś X ze skrótami miesięcy („lis”; styczeń z rokiem: „sty
  2027”). Na wąskim ekranie co druga lub co trzecia etykieta, tak by się
  nie nakładały. Wysokość ok. 200 px (ok. 160 px przy 360 px). Podpowiedź
  w dymku przy punkcie.
- **Prognoza na „Ten miesiąc”:** mały tekst pod paskiem postępu; status jako
  mała pigułka: „zdążysz” w kolorze sukcesu, „zagrożony” w kolorze
  ostrzeżenia, pozostałe neutralne. Kontrast co najmniej 4.5:1.
- **Plan podziału:** wymagana wpłata i sugestia w neutralnym bloku
  informacyjnym pod wierszem celu.
- **Ustawienia → Powiadomienia:** sekcja jak pozostałe sekcje Ustawień: pole
  adresu, trzy przełączniki z jednozdaniowym opisem, drugorzędny przycisk
  „Wyślij testowy mail”, lista ostatnich maili (data, temat, stan).
- **Podgląd maili w demo:** lista kart z tematem i treścią jako zwykły tekst
  z zachowaniem podziału na wiersze.

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
  (P15), zawsze przez połączenie szyfrowane (TLS). Aplikacja nadal nie
  przyjmuje połączeń z sieci.
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
  Wyjątek (po review B, D3): rozliczenie w tym dniu przed publikacją
  tabeli NBP używa poprzedniej tabeli, a ekran pokazuje jej datę.
- P11: kurs ręczny zostaje wyłącznie jako zapasowy, gdy NBP nie odpowiada.
- P12: tylko EUR; bez historii kursu w interfejsie.
- P13: powiadomienia mailowe przez dowolny serwer SMTP (domyślnie Gmail),
  sprawdzane codziennie przez Harmonogram zadań Windows, przy starcie,
  po rozliczeniu i po zapisie planu; zaległe wysyłane przy najbliższym
  sprawdzeniu, jeśli nadal aktualne.
- P14: zdarzenia: przypomnienie o przychodach 10. dnia (zawsze, za bieżący
  miesiąc), miesiąc do rozliczenia (gdy pojawia się nowy i co 7 dni), cel
  osiągnięty, cel zagrożony. Adresat: e-mail konta z możliwością zmiany.
- P15: maile zawierają kwoty, choć przechodzą przez serwer poczty;
  połączenie z serwerem zawsze szyfrowane.
- P16: demo nie wysyła maili, pokazuje podgląd.
- P17: historia wartości od wdrożenia, bez odtwarzania przeszłości; wykres
  sumy majątku na ekranie Majątek, punkt na koniec miesiąca, cała historia;
  źródła EUR po kursie NBP z końca danego miesiąca.
- P18: termin celu jako miesiąc i rok; aplikacja pokazuje wymaganą wpłatę
  i sugeruje procent, niczego nie zmienia sama.
- P19: prognoza ze średniej faktycznych wpłat z 3 ostatnich rozliczonych
  miesięcy, także dla celów bez terminu.
- P20: nowe elementy interfejsu w kierunku wizualnym „Portfel” z odświeżenia
  wyglądu realizowanego osobno; to odświeżenie aktualizuje rozdz. 8 przed
  zadaniami interfejsu Etapu 2, a rozdz. 8.1 opisuje elementy Etapu 2.
- P21 (po review E, D3): Docker Desktop uruchamia się automatycznie przy
  logowaniu — wymaganie wersji prywatnej, bez którego codzienne maile nie
  działają.
- P22 (po review B, D1): prognoza zostaje przy faktycznych wpłatach (P19);
  interfejs dopisuje, że nowy procent zadziała po rozliczeniu miesięcy
  z nowym planem.
- P23 (po review B, D2): cel bez danych do prognozy ma status „brak danych”
  i nie wywołuje maila „zagrożony”.

**Założenia Etapu 2 (zaproponowane przez agenta, zaakceptowane przez
właściciela produktu 2026-10-27 po review B i E):**
- Z10: kurs zapasowy jest używany tylko przy braku pasującego kursu NBP;
  do rozliczenia wystarcza tabela NBP z datą od D − 6 do D, gdzie D to
  ostatni dzień miesiąca (reguła 6.10).
- Z11: nowej tabeli NBP aplikacja szuka najwyżej raz na godzinę; ostrzeżenie
  o nieaktualnym kursie po 7 dniach.
- Z12: mail „cel osiągnięty” nie wychodzi, jeśli rozliczenie, po którym cel
  został osiągnięty, było ponad 30 dni temu (np. świeżo skonfigurowany SMTP
  nie wysyła starych wiadomości).
- Z13: grupy powiadomień domyślnie włączone; po ponownym włączeniu grupy
  wychodzą tylko maile nadal aktualne według tabeli w 5.10.
- Z14: pierwszy miesiąc prognozy to najstarszy nierozliczony miesiąc z celem
  (reguła 6.12), bo jego wpłata jeszcze nie jest w postępie; sugestia
  procentu dotyczy tylko miesięcy, które jeszcze nie istnieją (reguła 6.13).
- Z15: przy braku rozliczeń z celem prognoza bierze kwotę z planu
  najstarszego nierozliczonego miesiąca („planujesz”).
- Z16: w demo kursy rozliczeń przykładowych miesięcy są wygenerowane
  i oznaczone jako kurs zapasowy; bieżący kurs i kursy z końców miesięcy
  pochodzą z NBP, a gdy ich brak — z kursu zapasowego piaskownicy.

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

W scenariuszach z NBP dane pochodzą z atrapy NBP, która zwraca tylko
wymienione tabele.

22. **Bieżący kurs NBP:** gdy najnowsza tabela NBP jest z 27.10.2026
    z kursem 4,2731, Ustawienia pokazują „4,2731 zł · NBP, tabela
    z 27.10.2026”, a cel 220,50 zł ze źródłem EUR na „Ten miesiąc” ma
    drugą linię „≈ 51,60 €”.
23. **Kurs rozliczenia:** atrapa NBP ma tabele z 30.10.2026 (4,2650)
    i z 04.11.2026 (4,3000). Rozliczenie października wykonane 5.11.2026
    pokazuje „Kurs 4,2650 zł (NBP, 30.10.2026)”, pole celu 220,50 zł jest
    wstępnie wypełnione kwotą 51,70 €, a źródło EUR o wartości 1 000,00 € po
    zatwierdzeniu ma 1 051,70 €. Historia października pokazuje kurs 4,2650
    z datą 30.10.2026. Majątek po bieżącym kursie 4,3000 liczy to źródło jako
    4 522,31 zł.
24. **Kurs zapasowy:** NBP nie odpowiada, a aplikacja nie ma tabel
    z 25–31.10. Przy kursie zapasowym 4,3000 ekran rozliczenia października
    pokazuje „Kurs 4,3000 zł · kurs zapasowy” i 51,28 € dla celu 220,50 zł,
    a Historia zapisuje pochodzenie „zapasowy”. Bez kursu zapasowego
    rozliczenia nie da się zatwierdzić, a ekran prosi o kurs zapasowy.
    Miesiąc bez celu EUR rozlicza się w tej sytuacji bez kursu.
25. **Stan na koniec miesiąca:** źródło PLN o wartości 10 000,00 zł zmienione
    ręcznie 5.11.2026 na 10 500,00 zł i powiększone rozliczeniem 20.11.2026
    o 588,00 zł oraz źródło EUR 1 000,00 € bez zmian, przy tabeli NBP
    z 30.11.2026 (4,2500), dają punkt wykresu „Listopad 2026 · 15 338,00 zł”.
    Zmiana bieżącego kursu, edycja wartości źródła i zmiana waluty innego
    źródła w grudniu nie zmieniają tego punktu.
26. **Pusty wykres:** w miesiącu wdrożenia zapisu historii Majątek pokazuje
    „Wykres pojawi się w przyszłym miesiącu.”; w następnym miesiącu wykres ma
    dwa punkty (koniec miesiąca wdrożenia i stan bieżący).
27. **Prognoza z terminem:** dla danych z przykładu prognozy (rozdz. 6) przy
    terminie grudzień 2026 Plan podziału pokazuje „Do grudnia 2026 brakuje
    1 300,00 zł. Listopad ma już zaplanowane 588,00 zł, więc w każdym
    kolejnym miesiącu potrzebujesz 712,00 zł (średnio wpłacasz 566,66 zł).”
    i „Ustaw ok. 36,33% puli Oszczędności (teraz 30,00%) i zmniejsz
    pozostałe cele albo zwiększ procent puli.”, a „Ten miesiąc” pokazuje
    „Termin: grudzień 2026 · zagrożony”. Po zmianie terminu na marzec 2027:
    „Termin: marzec 2027 · zdążysz (ok. styczeń 2027)”, wymagana wpłata
    178,00 zł, bez sugestii procentu. Procenty planu nie zmieniają się same.
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
    sprawdzenie 31.10 wieczorem wysyła „Październik 2026 czeka na
    rozliczenie”, sprawdzenia 1–6.11 nie wysyłają nic, pierwsze sprawdzenie
    7.11 (o dowolnej godzinie) wysyła przypomnienie. Gdy przypomnienia
    wyszły 7.11, 14.11, 21.11 i 28.11, sprawdzenie 30.11 od razu wysyła
    „2 miesiące czekają na rozliczenie” (październik, listopad), a następne
    przypomnienie wychodzi najwcześniej 7.12. Po rozliczeniu wszystkich
    miesięcy kolejne sprawdzenia nie wysyłają nic.
31. **Mail o osiągniętym celu:** rozliczenie, po którym postęp celu z kwotą
    docelową 5 000 zł wynosi co najmniej 5 000 zł, wysyła jeden mail „Cel
    „Wakacje” osiągnięty”; kolejne rozliczenia nie wysyłają go ponownie. Po
    zmianie kwoty docelowej na 8 000 zł i jej osiągnięciu przy rozliczeniu
    wychodzi nowy mail. Obniżenie kwoty docelowej poniżej postępu nie wysyła
    maila. Gdy cel osiągnięto rozliczeniem z 1.10, a pierwsze sprawdzenie
    z działającym SMTP jest 5.11, mail nie wychodzi (ponad 30 dni).
32. **Mail o zagrożonym celu:** zapis terminu grudzień 2026 dla celu ze
    scen. 27 od razu wysyła jeden mail z kwotą 712,00 zł i sugestią 36,33%;
    kolejne sprawdzenia go nie powtarzają. Zapis terminu marzec 2027
    („zdążysz”), a zaraz potem znów grudzień 2026, bez innego sprawdzenia
    pomiędzy, wysyła nowy mail.
33. **Wysyłka i jej błędy:** bez konfiguracji SMTP Ustawienia pokazują
    „Wysyłka maili nie jest skonfigurowana” i nic nie jest wysyłane. Przy
    serwerze SMTP odrzucającym hasło „Wyślij testowy mail” pokazuje „Nie
    udało się wysłać: …”, a lista ostatnich maili pokazuje błąd; mail
    zdarzenia, którego nie udało się wysłać, wychodzi przy kolejnym
    sprawdzeniu po naprawie konfiguracji, jeśli jest nadal aktualny.
    Wyłączona grupa nie wysyła maili; grupa „Przychody” włączona 15.11
    wysyła mail za listopad przy najbliższym sprawdzeniu.
34. **Demo w Etapie 2:** piaskownica ma wykres z historią 12 miesięcy, cel
    z terminem „zdążysz” i cel „zagrożony”; kursy rozliczeń przykładowych
    miesięcy są oznaczone jako kurs zapasowy, a daty rozliczeń przypadają
    na początek następnego miesiąca. Ustawienia pokazują tylko podgląd
    maili (zawsze z „<poprzedni miesiąc> czeka na rozliczenie” i „Cel „…”
    jest zagrożony”), bez pola adresu, przełączników i testowego maila;
    żadna akcja w trybie demo nie łączy się z serwerem poczty.
35. **Rozliczenie przed publikacją tabeli:** rozliczenie listopada 30.11.2026
    rano, gdy atrapa NBP ma tabele do 27.11 (4,2600), pokazuje „Kurs
    4,2600 zł (NBP, 27.11.2026)”; to samo rozliczenie po publikacji tabeli
    z 30.11 (4,2500) pokazuje „Kurs 4,2500 zł (NBP, 30.11.2026)”.
36. **Zmiana kursu w trakcie rozliczenia:** ekran rozliczenia otwarty
    z kursem z 27.11; zanim użytkownik zatwierdzi, pojawia się tabela
    z 30.11. Zatwierdzenie jest odrzucone komunikatem „Kurs rozliczenia się
    zmienił. Sprawdź kwoty i zatwierdź ponownie.”, wartości źródeł się nie
    zmieniają, a ekran pokazuje kurs 4,2500 i przeliczone kwoty.
37. **Nowy procent a prognoza:** po zmianie procentu celu ze scen. 27 na
    36,33% (i zmniejszeniu innych celów) „Ten miesiąc” nadal pokazuje
    „zagrożony”, z dopiskiem „Prognoza uwzględni nowy procent po rozliczeniu
    miesięcy z nowym planem.”; nowy mail „zagrożony” nie wychodzi.
38. **Brak danych:** cel dodany 5.11.2026 z kwotą docelową 3 000 zł
    i terminem czerwiec 2027 (listopad istnieje bez niego) pokazuje „Termin:
    czerwiec 2027 · brak danych” i „Prognoza pojawi się, gdy cel trafi do
    planu miesiąca.”; Plan podziału pokazuje wymaganą wpłatę 428,58 zł
    (3 000 ÷ 7 miesięcy grudzień–czerwiec, w górę) i sugestię procentu; mail
    „zagrożony” nie wychodzi.
39. **Rozliczenia sprzed Etapu 2:** miesiąc rozliczony w MVP z celem EUR po
    kursie ręcznym 4,3000 pokazuje w Historii „Kurs 4,3000 zł (ręczny,
    sprzed Etapu 2)”; miesiąc bez celu EUR nie pokazuje kursu.
