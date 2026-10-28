# Review specyfikacji Etapu 2 (etap B): SPEC.md @ eb5ff64

Reviewer niezależny od autora. Zakres: zmiany Etapu 2 w `SPEC.md`
(`git diff origin/main...HEAD -- SPEC.md`): 5.9–5.12, zmiany w 5.2–5.8,
reguły 6.10–6.13 z przykładem prognozy, rozdz. 7 i 7.1, 9, 10, 11 (P9–P20,
Z10–Z16), scenariusze 22–34. Kontekst: reszta SPEC (MVP), diff STACK.md
i PLAN.md, docs/WORKFLOW.md, kod w `src/db/schema.ts`, `src/db/settlement.ts`,
`src/db/sources.ts`, `src/demo/generate.ts`, `src/domain/settlement.ts`,
commit odświeżenia wyglądu `7433fa1` (gałąź `feat-portfel-reskin`).

## 1. Werdykt

**REQUEST CHANGES** + **HUMAN DECISION** (D1–D3).

Wszystkie przykłady liczbowe i daty się zgadzają (rozdz. 4). Problemy są
w regułach, nie w arytmetyce: sugerowany procent w kanonicznym przykładzie
nie pozwala zdążyć z terminem (B1), nowy cel bez danych dostaje status
„zagrożony” i mail (B2), a kilka reguł powiadomień nie daje się
jednoznacznie przetestować (B3–B5). Po poprawkach B1–B9 i rozstrzygnięciu
D1–D3 specyfikacja spełni bramę etapu B.

## 2. Decyzje wymagane od człowieka

**D1. Czy prognoza i status terminu mają reagować na zmianę procentu?**
Zgodnie z P19 prognoza liczy się wyłącznie ze średniej faktycznych wpłat
z 3 ostatnich rozliczonych miesięcy. Skutek: po mailu „Cel zagrożony”
użytkownik ustawia sugerowany procent, a status zostaje „zagrożony” aż do
rozliczeń z nowym procentem. W przykładzie z rozdz. 6 (po poprawce B1:
36,33% od grudnia) status zmieni się dopiero wtedy, gdy cel będzie już
osiągnięty, czyli sugestia nigdy nie zmieni statusu na „zdążysz”. P19 nie
podważam, ale ta konsekwencja nie jest nigdzie zapisana.
- **A (rekomendowany): zostaje P19, interfejs to wyjaśnia.** Gdy procent celu
  w bieżącym planie różni się od procentu z rozliczonych miesięcy, przy
  prognozie pojawia się dopisek, np. „Prognoza uwzględni nowy procent po
  rozliczeniu miesięcy z nowym planem”. Dopisać zdanie do 5.12 i scenariusz.
- **B: prognoza od P liczy wpłaty z planu:** dla istniejących nierozliczonych
  miesięcy kwota z ich migawki, dla przyszłych bieżący procent × średnia
  kwota bazowa puli; średnia faktycznych wpłat zostaje tylko jako informacja.
  Zmienia P19 i reguły 6.12–6.13.

**D2. Co pokazuje cel z kwotą docelową, dla którego nie ma danych do
prognozy** (cel dodany do planu po utworzeniu bieżącego miesiąca albo przed
pierwszym przychodem)? Dziś reguła 6.13 daje mu „zagrożony” („także bez
prognozy”), więc wychodzi mail „Cel zagrożony” z pustą prognozą (szczegóły
w B2).
- **A (rekomendowany): status „brak danych”, bez maila.** Tekst na „Ten
  miesiąc” i w Planie: „Prognoza pojawi się, gdy cel trafi do planu
  miesiąca.” Plan podziału nadal pokazuje wymaganą wpłatę i sugestię
  (wymagają tylko `pozostało`, k i średniej kwoty bazowej puli).
- **B: „zagrożony” jak dziś,** z mailem, ale z treścią wyjaśniającą brak
  prognozy.

**D3. Rozliczenie ostatniego dnia miesiąca przed publikacją tabeli NBP.**
P10 mówi „kurs z ostatniego dnia rozliczanego miesiąca”, a reguła 6.10
w nawiasie dopuszcza poprzednią tabelę, jeśli użytkownik rozlicza ostatniego
dnia przed ok. 12:00. Ten sam miesiąc rozliczony o 9:00 i o 13:00 dostaje
różne kursy. To ciche zawężenie decyzji P10.
- **A (rekomendowany): zostawić regułę,** ale wpisać ją jawnie w 5.5 (ekran
  rozliczenia pokazuje datę tabeli, więc użytkownik to widzi) i do P10 jako
  „wyjątek: rozliczenie w ostatnim dniu przed publikacją tabeli”; dodać
  scenariusz.
- **B: w dniu końca miesiąca, przed publikacją tabeli z tego dnia
  (w dzień roboczy), rozliczenie EUR jest niedostępne** z komunikatem „Kurs
  NBP z dnia 30.11.2026 pojawi się ok. 12:00”. Zgodne z literą P10,
  ale wymaga wiedzy, czy dzień jest roboczy.

## 3. Problemy blokujące

**B1. Sugerowany procent pomija zamrożone migawki istniejących miesięcy,
więc w przykładzie z rozdz. 6 nie wystarcza do terminu.**
Miejsce: 5.12 (Plan podziału), reguła 6.13 (`wymagana wpłata`, `sugerowany
procent celu`), przykład prognozy, scen. 27 i 32.
Zmiana procentu działa tylko na miesiące utworzone po zmianie (5.3),
a k liczy miesiące od P, czyli także listopad, który już istnieje z planem
30%. Przy terminie grudzień 2026: listopad wpłaci 588,00 zł (migawka),
grudzień przy 33,17% wpłaci ⌊1 960,00 × 33,17%⌋ = 650,13 zł, razem
1 238,13 zł < 1 300,00 zł. Użytkownik, który posłucha sugestii, nie zdąży.
Poprawka: rozdzielić wymaganą wpłatę (informacja) od podstawy sugestii:
- `zaplanowane` = suma kwot celu z istniejących nierozliczonych miesięcy
  od P do T (dla EUR przeliczona regułą 8);
- `k'` = liczba miesięcy od P do T, które jeszcze nie istnieją;
- `sugerowany procent` = ⌈(`pozostało` − `zaplanowane`) ÷ k' ÷ `średnia kwota
  bazowa puli`⌉; gdy `pozostało` ≤ `zaplanowane` — sugestia zbędna; gdy
  k' = 0 — komunikat, np. „Zmiana procentu nie zdąży przed terminem”.
W przykładzie: (1 300,00 − 588,00) ÷ 1 = 712,00 zł, sugestia 36,33%
(712 ÷ 1 960 = 36,326…% w górę). Poprawić przykład, scen. 27 i 32. Przykład
musi też jawnie mówić, czy listopad już istnieje (dziś tylko „listopad jest
nierozliczony”).

**B2. Brak prognozy z braku danych miesza się z „nie zostanie osiągnięty”
i daje fałszywy alarm.**
Miejsce: 5.12, reguła 6.12 (ostatni punkt), 6.13 („także bez prognozy”),
5.10 (cel zagrożony).
Reguła 6.12 ma dwa różne przypadki „prognozy nie ma”: brak jakiegokolwiek
miesiąca z celem oraz średnia = 0, a ostatni punkt opisuje oba jednym
tekstem „nie zostanie osiągnięty”. 5.12 podaje tekst tylko dla średniej 0.
Nowy cel dodany w listopadzie nie ma rozliczeń ani migawki (listopad już
istnieje bez niego), więc przez cały miesiąc jest „zagrożony” i wychodzi
mail z pustą prognozą.
Poprawka: rozdzielić stany w 6.12 („brak danych” i „średnia 0”), dopisać
tekst UI dla „brak danych” i zachowanie statusu oraz maila wg D2.

**B3. Zmiana statusu „zagrożony” nie jest obserwowalna między
sprawdzeniami; scen. 32 nie jest deterministyczny.**
Miejsce: 5.10 (cel zagrożony), rozdz. 7, scen. 32; STACK (`risk_notified`).
Status zależy od planu, terminu, rozliczeń i daty, a sprawdzenia są tylko
przy starcie, codziennie i po rozliczeniu, nie po zapisie planu. W scen. 32
użytkownik zmienia termin na marzec i z powrotem na grudzień; jeśli między
zapisami nie było sprawdzenia, aplikacja nigdy nie widzi „zdążysz” i nie
wysyła nowego maila. Nieokreślone są też: czy cel, który od razu po
ustawieniu terminu jest zagrożony, „zmienia status” (raczej tak); czy
przejście zagrożony → „termin minął” → nowy termin i znów zagrożony daje
nowy mail („straci termin” nie obejmuje „termin minął”).
Poprawka: zapisać w 5.10, że status jest oceniany przy każdym sprawdzeniu
**i przy każdym zapisie planu/celu** (albo że zapis planu wyzwala
sprawdzenie, jak rozliczenie); że pierwsza ocena „zagrożony” liczy się jako
zmiana; jak traktowany jest „termin minął”. Scen. 32 dopisać kroki
sprawdzeń.

**B4. Rytm maili o rozliczeniu przy kolejnym miesiącu i definicja „7 dni”.**
Miejsce: 5.10 pkt 2, P14, scen. 30.
P14: „w dniu końca i co 7 dni”. 5.10: jeden licznik dla całej grupy („od
poprzedniego maila tej grupy minęło co najmniej 7 dni”). Gdy przypomnienie
o październiku wyszło 28.11, a 30.11 kończy się listopad, 5.10 każe czekać
do 5.12, a P14 sugeruje mail 30.11. Do tego „7 dni” nie mówi, czy to dni
kalendarzowe, czy 168 godzin: mail z 31.10 o 20:00 i sprawdzenie 7.11
o 8:00 dają różny wynik, więc scen. 30 zależy od godziny.
Poprawka: „7 dni kalendarzowych (Europe/Warsaw), licząc od dnia poprzedniego
maila” oraz jednoznacznie: koniec kolejnego miesiąca wysyła mail od razu
(i liczy 7 dni od nowa) albo nie. Dodać ten przypadek do scen. 30.

**B5. „Nadal aktualny” nie jest zdefiniowany per zdarzenie; Z13 jest
sprzeczne z tabelą rozdz. 7.**
Miejsce: 5.10 (akapit „Kiedy aplikacja sprawdza”, „Błąd wysyłki”), rozdz. 7
(„Grupa powiadomień wyłączona, potem włączona”), Z12, Z13.
Przykład: grupa „Przychody” wyłączona 10.11, włączona 15.11. Wg 5.10 pkt 1
mail jest aktualny do końca listopada, więc wyjdzie 15.11. Wg Z13 „bez
zaległych z okresu wyłączenia”, więc nie. Podobnie „Cel osiągnięty” po
ponownym włączeniu w ciągu 30 dni od rozliczenia. Test nie ma jak ustalić
oczekiwanego wyniku.
Poprawka: jedna tabela w 5.10 „mail jest aktualny, gdy…”: przychody —
od 10. do końca tego miesiąca; rozliczenie — gdy jakiś miesiąc czeka;
osiągnięty — do 30 dni od rozliczenia; zagrożony — dopóki status jest
„zagrożony”. Potem jedno zdanie, że ponowne włączenie grupy, naprawa SMTP
i błąd wysyłki podlegają tej samej tabeli (i poprawić Z13 albo tabelę 7,
zależnie od intencji). Dodać scenariusz do 33.

**B6. Kierunek wizualny nowych elementów jest sprzeczny i niedookreślony.**
Miejsce: P20, rozdz. 8, 5.11, 5.12, 5.10 (Ustawienia, podgląd w demo).
P20 mówi, że nowe elementy są w kierunku „Portfel” i że „rozdz. 8 opisuje
obowiązujący kierunek”, a rozdz. 8 opisuje wariant B (Sora/DM Sans,
nawigacja na górze), który commit `7433fa1` właśnie zastępuje (Manrope,
boczny pasek). Odświeżenie nie zmienia SPEC 8. Nowe elementy nie mają makiet
ani opisu: wykres (osie, skala Y od 0 czy od minimum, kolor, siatka, etykiety
miesięcy na 360 px), linia prognozy na „Ten miesiąc” (dla celu z terminem
i statusem „zdążysz” jest pokazywany termin czy prognoza, czy obie?),
blok sugestii w Planie, sekcja Powiadomienia i podgląd maili w demo, format
maila (tekst czy HTML).
Poprawka: ustalić, która gałąź aktualizuje rozdz. 8 i przed którym
zadaniem; w rozdz. 8 dopisać krótki opis tych elementów (jak dla „Ten
miesiąc” w MVP) albo wskazać makiety Portfel; w 5.12 jednoznacznie, jaka
linia przy każdym statusie.

**B7. Demo w Etapie 2 ma luki, które blokują scen. 34.**
Miejsce: 5.8, 5.10 (Demo), Z16, scen. 34.
- Wykres demo z 12 miesięcy wymaga kursu na koniec każdego miesiąca
  (reguła 6.11). Z16 mówi tylko o kursach rozliczeń (wygenerowane)
  i bieżącym (NBP). Nie wiadomo, czy punkty wykresu używają prawdziwych tabel
  NBP (12 miesięcy pobrań przy pierwszym wejściu), czy kursów wygenerowanych.
  Dziś historia pokaże kurs rozliczenia 4,31, a punkt wykresu z tego samego
  dnia policzy się np. po 4,25.
- Generator (`src/demo/generate.ts`, `src/db/demo.ts`) ustawia `settledAt = now`
  dla rozliczonych miesięcy. Wymóg „historia zgodna z rozliczeniami” oznacza
  daty rozliczeń w przeszłości, a od nich zależy podgląd „Cel osiągnięty”
  (okno 30 dni). SPEC powinien to wymagać.
- Nie wiadomo, czy w demo Ustawienia → Powiadomienia mają pole adresu,
  przełączniki i „Wyślij testowy mail” (i co robią) czy tylko podgląd.
- Scen. 34 nie mówi, jakie maile ma zawierać podgląd (np. zawsze
  „<poprzedni miesiąc> czeka na rozliczenie”, bo demo ma zaległy miesiąc).
- 5.8 nadal mówi „działa tak samo jak wersja prywatna (5.2–5.7)”, powinno
  być 5.2–5.12 z wyjątkiem wysyłki z 5.10.
Poprawka: dopisać te punkty do 5.8 i Z16 i zaostrzyć scen. 34.

**B8. Miesiące rozliczone przed Etapem 2 nie mają daty ani pochodzenia
kursu.**
Miejsce: 5.6 („widać kurs rozliczenia z datą i pochodzeniem”), 5.9.
W MVP `months.settled_eur_rate` to sam kurs ręczny. STACK rozstrzyga to za
SPEC: „`fallback` i data rozliczenia”, więc Historia pokaże np.
„4,3000 zł · kurs zapasowy, 15.10.2026”, choć to nie był kurs zapasowy, a data
nie jest datą tabeli. To decyzja o tym, co widzi użytkownik na jego
prawdziwych danych.
Poprawka: w 5.6 opisać wygląd starych miesięcy, np. „Kurs 4,3000 zł (ręczny,
sprzed Etapu 2)” bez daty tabeli, i zgodnie z tym poprawić STACK
(np. `settled_rate_source = manual`).

**B9. Zmiana waluty źródła psuje historię wartości.**
Miejsce: 5.2 (zmiana waluty źródła dozwolona, gdy nie ma celu ani
rozliczeń), 5.11, reguła 6.11.
Źródło PLN z historią 10 000 zł zmienione na EUR: reguła 6.11 przeliczy
dawne zapisy jako 10 000 € po kursie z końca tamtych miesięcy, więc punkty
z przeszłości wzrosną ok. 4,3 raza. Sprzeczne z 5.11 („korekta to nowa
zmiana z bieżącą datą”, punkty z przeszłości stałe).
Poprawka: zapis historii przechowuje walutę z chwili zapisu i reguła 6.11
jej używa; albo zmiana waluty jest zablokowana, gdy źródło ma historię
(w praktyce zawsze, więc blokada zmienia MVP). Rekomenduję pierwszy wariant.

## 4. Weryfikacja

Przeliczone samodzielnie (Node, arytmetyka całkowita, zaokrąglenia jak
w regule 6.8):

| Miejsce | Obliczenie | Wynik |
| --- | --- | --- |
| Scen. 22 | 22 050 gr ÷ 4,2731 = 5 160,18 ec | 51,60 € ✓ |
| Scen. 23 | 22 050 ÷ 4,2650 = 5 169,99 → 51,70 €; 1 051,70 × 4,3000 | 51,70 €, 4 522,31 zł ✓ |
| Scen. 24 | 22 050 ÷ 4,3000 = 5 127,9 | 51,28 € ✓ |
| Scen. 25 | 10 500 + 588 + 1 000 × 4,25 | 15 338,00 zł ✓ |
| Przykład 6 / scen. 27–28 | postęp 2 000 + 588 + 512 + 600; średnia ⌊1 700 ÷ 3⌋; n = ⌈1 300 ÷ 566,66⌉ = ⌈2,294⌉; P + 2 | 3 700; 566,66; 3; styczeń 2027 ✓ |
| j.w., termin XII 2026 | k = 2 (XI, XII); 1 300 ÷ 2; ⌈65 000 × 10 000 ÷ 196 000⌉ = ⌈3 316,33⌉ | 650,00 zł; 33,17% ✓ (ale B1) |
| j.w., termin III 2027 | k = 5 (XI–III); 1 300 ÷ 5; styczeń ≤ marzec | 260,00 zł; „zdążysz” ✓ |
| B1 | ⌊196 000 × 3 317 ÷ 10 000⌋ = 65 013; 58 800 + 65 013 | 1 238,13 zł < 1 300 zł ✗ |
| Spójność z MVP | scen. 11 (3 100 / 5 000) + październik 600 = 3 700; plan 588 = 9 800 × 20% × 30% | ✓ |

Daty 2026 (dni tygodnia): 24.10 sobota, 27.10 wtorek, 30.10 piątek,
**31.10 sobota** (tabela z 30.10 jako kurs rozliczenia października ✓),
1.11 niedziela, 2.11 poniedziałek, 4.11 środa, 5.11 czwartek, 7.11 sobota
(31.10 + 7 dni ✓), 10.11 wtorek, 12.11 czwartek, 20.11 piątek,
**30.11 poniedziałek** (jest tabela z tego dnia ✓), 1.12 wtorek,
24.12 czwartek.

Sprawdzone też:
- Kod MVP: `months` ma tylko `settled_eur_rate` (B8); `sources.currency` da
  się zmienić (B9); generator demo ustawia rozliczenia na `now` (B7);
  `settleMonth` bierze kurs z `settings.eur_rate` wewnątrz transakcji
  (Etap 2 to zmienia, STACK opisuje ustalenie kursu przed transakcją).
- Brak usuwania i przywracania źródeł w kodzie, więc lista powodów zapisu
  historii (dodanie, edycja, rozliczenie, archiwizacja) jest kompletna.
- Commit `7433fa1` nie zmienia `SPEC.md` (B6).
- Spójność 5.10 ↔ rozdz. 7 ↔ scen. 29–33: deduplikacja (7: „dwa
  sprawdzenia naraz”), 30 dni (Z12, brak scenariusza, uwaga 6), 7 dni (B4),
  ponowne włączenie (B5), zagrożony (B3).

Ocena założeń:
- **Z10** — akceptuję; doprecyzować granice okna (uwaga 1).
- **Z11** — akceptuję.
- **Z12** — akceptuję; 30 dni od chwili rozliczenia, dodać do scenariusza
  (uwaga 6).
- **Z13** — akceptuję dopiero po B5 (dziś sprzeczne z tabelą 7).
- **Z14** — akceptuję dla prognozy; dla sugestii procentu prowadzi do B1.
- **Z15** — akceptuję; tekst „średnio wpłacasz” jest wtedy nieprawdziwy
  (uwaga 3).
- **Z16** — akceptuję po uzupełnieniu o kursy punktów wykresu (B7).

## 5. Uwagi nieblokujące

1. Reguła 6.10: „tabela z ostatnich 7 dni przed końcem M” — podać granice
   (np. „z datą od D−6 do D”). Scen. 24 mówi „24–31.10”, czyli 8 dni.
   `Kurs na dzień` nie ma limitu wieku, więc wykres (6.11) i bieżący kurs mogą
   użyć tabeli sprzed miesięcy, a rozliczenie nie; warto to ujednolicić albo
   świadomie zostawić.
2. 5.9 opisuje tylko szukanie „nowszej tabeli”. Rozliczenie (scen. 23)
   i wykres potrzebują tabel historycznych; STACK to pokrywa, SPEC warto
   wyrównać. Punkt wykresu policzony kursem zapasowym zmieni się po
   późniejszym pobraniu tabeli albo zmianie kursu zapasowego; dopisać, że to
   dopuszczalne.
3. Gdy średnia pochodzi z planu (Z15), tekst „(średnio wpłacasz X)” należy
   zmienić, np. na „(planujesz X)”.
4. „Ostatnie 3 rozliczone miesiące” (6.12, 6.13) — według miesiąca
   kalendarzowego, nie daty rozliczenia (rozliczenie może iść nie po kolei).
   W 6.13 dopisać, czy liczą się miesiące z celem w migawce, jak w 6.12.
5. Walidacja terminu (7.1) dopuszcza bieżący miesiąc, także rozliczony;
   wtedy T < P i od razu „termin minął”. Proponuję regułę T ≥ P albo zgodę na
   to w tabeli 7. Brak górnej granicy terminu (np. rok 9999).
6. Scen. 31 nie sprawdza okna 30 dni (Z12) ani obniżenia kwoty docelowej
   poniżej postępu (cel osiągnięty bez rozliczenia, więc wg 5.10 bez maila).
   Dopisać to wprost, wraz z odpowiedzią na „5 000 → 8 000 → 5 000”.
7. „Każdy mail wychodzi najwyżej raz” razem z ponawianiem po błędzie nie jest
   ściśle wykonalne (timeout po przyjęciu przez serwer daje duplikat).
   Napisać „mail jest wysłany, gdy serwer SMTP go przyjął”. Doprecyzować, czy
   lista 10 ostatnich maili pokazuje każdą próbę i mail testowy.
8. Scen. 23: NBP publikuje tabele także 2.11 i 3.11 (dni robocze). Opisać to
   jako dane atrapy („atrapa NBP ma tylko tabele…”), a rozliczenie 5.11 przed
   publikacją tabeli z 5.11.
9. Ekran rozliczenia: czy zapisywany jest kurs pokazany przy otwarciu
   formularza, czy ustalony przy zatwierdzeniu (różnią się, gdy w międzyczasie
   pojawi się tabela albo NBP wróci).
10. 5.11 / scen. 26: „po pierwszym pełnym miesiącu historii”, a wykres pojawia
    się 1. dnia następnego miesiąca po niepełnym miesiącu wdrożenia. Dla
    pierwszego punktu nie ma zmiany w podpowiedzi. „Wdrożenie Etapu 2” to
    w praktyce merge T17 (PLAN robi go wcześniej), więc napisać „od wdrożenia
    zapisu historii”.
11. Cel EUR bez żadnego kursu: brak zachowania dla sugestii procentu i dla
    punktów wykresu ze źródłem EUR (tabela 7 mówi tylko o sumie majątku).
12. Sugestia procentu celu wymaga zmniejszenia innych celów puli (suma
    100,00%, 5.3); warto dopisać do komunikatu „…i zmniejsz pozostałe cele”
    albo wskazać też zwiększenie procentu puli.
13. Treść maila „zagrożony” przy braku prognozy albo przy „Nawet 100% puli
    nie wystarczy” nie jest opisana. Temat dla wielu miesięcy wymaga odmiany
    („5 miesięcy czeka”).

## 6. Rozstrzygnięcia (autor SPEC, 2026-10-27)

Właściciel produktu przyjął wszystkie rekomendacje.

- **D1 → A** (SPEC P22): prognoza zostaje przy faktycznych wpłatach,
  dopisek o nowym procencie w 5.12, scen. 37.
- **D2 → A** (SPEC P23): status „brak danych”, bez maila; 5.12, reguły
  6.12–6.13, rozdz. 7, scen. 38.
- **D3 → A**: wyjątek zapisany w P10, 5.5 i regule 6.10; scen. 35.
- **B1:** reguła 6.13 rozdziela `zaplanowane` i k (tylko miesiące jeszcze
  nieistniejące); przykład mówi wprost, że listopad istnieje; nowe liczby
  712,00 zł / 36,33% / 178,00 zł w przykładzie i scen. 27, 32.
- **B2:** zob. D2.
- **B3:** 5.10 — status oceniany przy każdym sprawdzeniu i po zapisie
  planu lub celu, pierwsza ocena liczy się jako zmiana, ponowny mail po
  dowolnym innym statusie; scen. 32 bez sprawdzenia pomiędzy zmianami.
- **B4:** 5.10 — nowy miesiąc do rozliczenia daje mail od razu, 7 dni
  kalendarzowych (Europe/Warsaw) od dnia ostatniego wysłanego maila;
  scen. 30 z przypadkiem 30.11.
- **B5:** tabela „Kiedy / Aktualny” w 5.10; Z13 i wiersz rozdz. 7
  uzgodnione z tabelą; scen. 33 z włączeniem grupy 15.11.
- **B6:** P20 — rozdz. 8 aktualizuje odświeżenie „Portfel” przed zadaniami
  interfejsu; nowy rozdz. 8.1 opisuje elementy Etapu 2, tabela linii
  prognozy w 5.12, maile jako zwykły tekst.
- **B7:** 5.8 (odwołanie 5.2–5.7 i 5.9–5.12, daty rozliczeń, kursy demo
  jako zapasowe, kursy wykresu), Z16, scen. 34.
- **B8:** pochodzenie „ręczny, sprzed Etapu 2” w 5.6 i regule 6.10;
  scen. 39; STACK `manual`.
- **B9:** historia zapisuje walutę (5.11, reguła 6.11, rozdz. 7).
- **Uwagi nieblokujące** uwzględnione: 1 (okno D − 6 … D, scen. 24),
  2 (pobieranie tabel do rozliczenia i wykresu, zmiana punktu po kursie
  zapasowym), 3 („planujesz”), 4 (miesiące kalendarzowe), 5 (termin ≥ P,
  górna granica 2099), 6 (scen. 31), 7 („wysłany = przyjęty przez SMTP”,
  lista z testowymi i ostatnim stanem), 8 (atrapa NBP w scenariuszach),
  9 (zmiana kursu w trakcie rozliczenia, scen. 36), 10 („w przyszłym
  miesiącu”, „od wdrożenia zapisu historii”), 11 (cel EUR bez kursu),
  12 („…i zmniejsz pozostałe cele…”), 13 (treść maila „zagrożony”, odmiana
  w temacie).
