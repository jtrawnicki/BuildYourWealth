# Review specyfikacji: prognoza majątku (etap B), SPEC.md @ 79c1c8a

Reviewer niezależny od autora. Zakres: zmiana zakresu Etapu 2 z 2026-10-29
w `SPEC.md` (`git diff main...HEAD -- SPEC.md`): wycofanie 5.10 i powiązanych
miejsc (P13–P16, P21, Z12, Z13, scen. 29–33, rozdz. 7, 9, 10), nowe 5.13,
zmiany w 4, 5.2, 5.7, 5.8, reguła 6.14 z przykładem prognozy majątku, wiersze
rozdz. 7 i 7.1, 8.1, decyzje P24–P30, założenia Z17–Z19, scenariusze 40–47.
Kontekst: reszta SPEC, diff STACK.md i PLAN.md, `docs/WORKFLOW.md`, kod
w `src/domain/plan.ts`, `src/domain/arithmetic.ts`, `src/ui/nav.ts`,
`src/ui/MainNav.module.css`, `src/app/(app)/layout.tsx` i `layout.module.css`,
`src/db/schema.ts`, `src/rates/current-rate.ts`, `e2e/layout.spec.ts`.

Decyzje właściciela wymienione w zleceniu (bez AI i zewnętrznych API,
scenariusze +5/+10/+15% od średniego przychodu z 6 miesięcy, wpłaty z planu,
4 linie naraz, horyzont 5/10/15 albo 1–40, bez inflacji i pasma, stopa per
źródło z pustym = 0%, symulacja bez zapisu, progi automatyczne, brak
przycisku motywu na dolnej belce) przyjmuję jako wiążące i ich nie oceniam.

## 1. Werdykt

**REQUEST CHANGES** + **HUMAN DECISION** (D1–D2).

Arytmetyka się zgadza: przykład prognozy majątku z rozdz. 6 i scen. 40–42,
44, 45 przeliczyłem co do grosza (rozdz. 4). Wycofanie maili jest czyste —
nie zostały odwołania do 5.10 ani scen. 29–33 poza zapisem historii.
Blokują trzy luki w regułach tekstów i zachowania, których test nie ma jak
sprawdzić: zdanie „Wpłaty kontra zysk” przy zysku ujemnym, zerowym majątku
i horyzoncie innym niż „5 lat” (B1), sprzeczność scen. 47 z leniwym
pobieraniem kursu NBP (B2) oraz brak dopisku „z ilu miesięcy” dla średniej
z bieżącego miesiąca (B3). Do tego D1: dopuszczalna stopa 50% daje kwoty
poza zakresem obliczeń już przy realnych danych.

## 2. Decyzje wymagane od człowieka

**D1. Górna granica zakładanej stopy zwrotu (7.1: od −50 do 50).**
Zakres stopy nie jest wśród decyzji P29 — zaproponował go autor. Przy 50%
rocznie i horyzoncie 40 lat 1 000 zł rośnie do 323 453 689 533,59 zł,
a wynik przekracza bezpieczny zakres liczb całkowitych JavaScriptu
(`Number.MAX_SAFE_INTEGER`, ok. 90 bln zł w groszach), gdy źródło ma
co najmniej **278 472,07 zł** albo wpłata wynosi co najmniej
**11 603,01 zł miesięcznie** (przeliczone, rozdz. 4). SPEC nie mówi, co wtedy
widzi użytkownik, a STACK każe takiej wartości kończyć się błędem domeny
(skutki techniczne: review E, B1).
- **A (rekomendowany): zakres od −50 do 20%.** Przy 20% przekroczenie
  wymaga źródła od ok. 32,3 mld zł albo wpłaty od ok. 538 mln zł
  miesięcznie, czyli powyżej realnych danych (górna granica kwot to 2 mld,
  STACK 4). Komunikat „Wpisz stopę od −50 do 20, np. 6,5”; scen. 43
  („60” odrzucone) bez zmian. Prognoza na 40 lat przy 50% i tak nie niesie
  informacji.
- **B: zostaje 50%.** SPEC dopisuje zachowanie dla bardzo dużych kwot
  (np. format osi i kart dla miliardów), a STACK liczy i przekazuje kwoty
  prognozy na `BigInt` aż do formatowania, bez zamiany na `number`.

**D2. Założenie Z19 a zaległe nierozliczone miesiące.**
Z19 mówi, że pominięta jest „zaplanowana, a jeszcze nierozliczona wpłata
bieżącego miesiąca”. Ten sam mechanizm (start od bieżących wartości źródeł,
k = 1 to następny miesiąc) pomija też wpłaty **zaległych** miesięcy: 1.11
z nierozliczonym październikiem prognoza nie liczy ani wpłaty
październikowej, ani listopadowej. Po rozliczeniu października majątek
w k = 0 rośnie o tę wpłatę.
- **A (rekomendowany): zostaje jak jest, ale jawnie.** Z19 dopisuje „także
  wpłaty zaległych nierozliczonych miesięcy; uwzględnia je dopiero
  rozliczenie”. Prosto i spójnie z „wartości źródeł zmienia tylko
  rozliczenie”.
- **B: k = 0 dolicza zaplanowane kwoty celów** z nierozliczonych miesięcy
  (bieżącego i zaległych) do źródeł. Dokładniej, ale „majątek dziś” na
  Prognozie różni się wtedy od sumy majątku na pozostałych ekranach.

## 3. Problemy blokujące

**B1. Zdanie i wykres „Wpłaty kontra zysk” nie mają zachowania dla
dozwolonych przypadków.**
Miejsce: 5.13 („Wpłaty kontra zysk”), reguła 6.14 (`udział zysku`, „każda
złotówka”), rozdz. 7 (ujemna stopa).
- **Odmiana horyzontu:** wzór „Za 5 lat…” przy własnym horyzoncie 1–40 daje
  „Za 1 lat”, „Za 2 lat”, „Za 22 lat”. Potrzebna odmiana (rok / lata /
  lat).
- **Zysk ujemny albo zerowy:** ujemna stopa jest dozwolona (7.1 i 7), a SPEC
  opisuje tylko warstwę i legendę. Zdanie wyszłoby „Za 5 lat −3% majątku to
  zysk z założonych stóp zwrotu”. Mieszane stopy (np. jedno źródło +6%,
  drugie −10%) mogą dać zysk ujemny, choć „żadne źródło nie ma stopy” nie
  zachodzi. Zysk dokładnie 0 przy niezerowych stopach daje „0% majątku to
  zysk”.
- **Dzielenie przez zero:** `udział zysku` = zysk ÷ majątek końcowy. Przy
  aktywnych źródłach o wartości 0 i planie 0% (5.13 wprost dopuszcza „plan
  z pulami 0%”) majątek końcowy = 0.
- **Warstwy przy zysku ujemnym:** bez warstwy zysku stos „majątek dziś +
  wpłaty” jest wyższy niż faktyczny majątek scenariusza; nie wiadomo, czy
  wykres to pokazuje, czy obcina.
Poprawka: dopisać w 5.13 odmianę „Za {N} rok/lata/lat” oraz osobny tekst
dla zysku ≤ 0 (np. „Przy założonych stopach majątek za 5 lat będzie
o 1 234 zł niższy niż suma wpłat i majątku dziś.”), pominięcie pierwszego
zdania przy majątku końcowym 0 i sposób rysowania warstw przy zysku
ujemnym. Dodać przypadek do scen. 43 albo nowego scenariusza.

**B2. Scen. 47 i P27 są sprzeczne z leniwym pobieraniem kursu NBP (5.9).**
Miejsce: 5.13 (ostatni punkt), P27, rozdz. 10, scen. 47.
Prognoza używa `bieżącego kursu` (reguła 6.14, scen. 45). Bieżący kurs
w kodzie ustala `resolveCurrentRate` (`src/rates/current-rate.ts`), który
w renderze strony pobiera brakujące tabele z NBP. Otwarcie Prognozy przy
źródle EUR wyśle więc żądanie do `api.nbp.pl`, a scen. 47 wymaga, żeby
„nie wysyłały żadnego żądania poza aplikację”. P27 („bez wywołań
zewnętrznych API dla prognozy”) czyta się tak samo.
Poprawka: scen. 47 — „przeglądarka nie wysyła żądań poza aplikację; serwer
łączy się najwyżej z NBP po kurs, jak na pozostałych ekranach (5.9), bez
danych użytkownika”. Albo, jeśli intencją jest zero połączeń: Prognoza
używa tylko kursu już zapisanego w bazie (wtedy dopisać to do 5.13
i reguły 6.14).

**B3. Dopisek „z ilu miesięcy” jest niezdefiniowany dla średniej
z bieżącego miesiąca i mylący przy przerwach.**
Miejsce: 5.13 (Punkt wyjścia), reguła 6.14 (`średni przychód`), rozdz. 7,
scen. 42.
Gdy przed bieżącym miesiącem nie ma przychodu, średnia to przychód
bieżącego miesiąca, ale SPEC nie mówi, jaki dopisek pokazuje karta
(„ostatni 1 miesiąc”? „bieżący miesiąc”?), a scen. 42 tego nie sprawdza.
Do tego 6 „najnowszych miesięcy z przychodem” nie musi być ciągiem
(miesiące tworzy się tylko przez przychód, P6), więc „ostatnie 6 miesięcy”
może opisywać okres dwóch lat.
Poprawka: dopisek dla przypadku zastępczego, np. „bieżący miesiąc, jeszcze
niepełny”, i sprawdzenie go w scen. 42; dopisek ogólny np. „6 ostatnich
miesięcy z przychodem” albo z zakresem („maj–październik 2026”).

## 4. Weryfikacja

Przeliczone samodzielnie (Node, `BigInt`, grosze, zysk miesiąca
`wartość × s ÷ 120 000` z zaokrągleniem połówek od zera, kwoty pokazywane
do pełnych złotych połówkami w górę, jak w regule 6.14; skrypt
w katalogu roboczym sesji):

| Miejsce | Obliczenie | Wynik |
| --- | --- | --- |
| Przykład 6.14, k = 1 | 1 000 000 × 600 ÷ 120 000 = 5 000 gr; 10 000 + 50 + 1 000; + 2 000 | 11 050,00 / 13 050,00 zł ✓ |
| j.w., k = 2 | 1 105 000 × 600 ÷ 120 000 = 5 525 gr; 11 050 + 55,25 + 1 000 | 12 105,25 / 14 105,25 zł ✓ |
| j.w., k = 12 | 12 kroków | 24 952,36 zł ✓ |
| j.w., k = 60 bazowy | 85 258,55 zł → pełne zł | 85 259 zł ✓ |
| +5% / +10% / +15% | wpłata 1 050 / 1 100 / 1 150 zł; 88 747,09 / 92 235,51 / 95 724,00 | 88 747 / 92 236 / 95 724 zł ✓ |
| Różnice w kartach (scen. 40) | różnice zaokrąglonych kwot | +3 488 / +6 977 / +10 465 zł ✓ |
| „Wpłaty kontra zysk” | 60 × 1 000; 85 258,55 − 12 000 − 60 000 = 13 258,55 | 60 000 zł; 13 259 zł ✓; 12 000 + 60 000 + 13 259 = 85 259 ✓ |
| Udział zysku, złotówka | 13 258,55 ÷ 85 258,55 = 15,55%; 73 258,55 ÷ 60 000 = 1,2209 | 16%; 1,22 zł ✓ |
| Kamienie milowe | pierwsze k z majątkiem ≥ 50 000 zł: 34 / 32 / 31 / 30; k = 1 to listopad 2026 | VIII / VI / V / IV 2029 ✓ |
| Progi | progi > 12 000 i ≤ 95 724 | tylko 50 tys. ✓ |
| Tabela źródeł (scen. 40) | „Konto” 83 258,55; „Gotówka” 2 000 | 83 259 zł, 2 000 zł ✓ |
| Scen. 41 | (1 000 + 500 + 900) ÷ 3 | 800,00 zł ✓ |
| Scen. 42 | (9 000 + 11 000) ÷ 2; tylko październik | 10 000,00 zł; 4 000,00 zł ✓ |
| Scen. 44 | k = 300 od listopada 2026 | październik 2051 ✓ |
| Scen. 45 | 100 000 ec × 4,2700 | 4 270,00 zł ✓ |
| Zakres (D1) | wyszukiwanie binarne, 480 miesięcy, próg `MAX_SAFE_INTEGER` | 50%: 278 472,07 zł / 11 603,01 zł mies.; 40%: 13,16 mln / 438 589 zł; 30%: 641 mln / 16 mln; 20%: 32,3 mld / 538 mln |

Spójność wewnętrzna:
- Wycofanie maili: brak odwołań do 5.10, P13–P16, P21, Z12, Z13 i scen.
  29–33 poza zapisami „wycofane” i historią decyzji. Rozdz. 7 (termin minął,
  usunięcie celu, cel bez danych, obniżenie kwoty docelowej) i scen. 34, 37,
  38 oczyszczone z maili. 5.8 odwołuje się do 5.2–5.7, 5.9, 5.11–5.13 ✓.
  Rozdz. 10: jedno połączenie wychodzące (NBP) ✓.
- Numeracja: P24–P30, Z17–Z19, scen. 40–47 ciągłe; scen. 29–33 zostawione
  jako „wycofane” bez przenumerowania ✓.
- Reguła 6.14 a reguły 2–3: `computeMonthPlan` (`src/domain/plan.ts`) liczy
  kwoty celów z zaokrągleniem w dół na `BigInt` — wpłatę do źródła da się
  policzyć tą funkcją dla `przychodu scenariusza` ✓. `validatePlan` wymaga
  celów dla puli > 0%, więc „procent odkładany” i „wpłata według planu”
  różnią się tylko resztą z zaokrągleń ✓.
- Nawigacja: `NAV_TABS` ma dziś pięć zakładek w kolejności Ten miesiąc,
  Majątek, Plan, Historia, Ustawienia — „Prognoza” między Historią
  a Ustawieniami daje sześć ✓. `ThemeToggle` siedzi w `railFoot`, który na
  wąskim ekranie jest częścią dolnej belki — P30 to ukrycie go regułą CSS ✓.
- Schemat: `sources` nie ma kolumny stopy (dochodzi w T28); `goals.deadline`
  już jest (T21); brak kolumn i tabel powiadomień — zdanie PLAN „kod ich nie
  zawierał” prawdziwe (grep `notify` w `src/`, `scripts/` pusty).
- `arithmetic.ts`: `toSafeInteger` rzuca `RangeError` poza zakresem
  (podstawa D1); pomocnicze zaokrąglenia są tylko dla wartości nieujemnych.

Ocena założeń:
- **Z17** — akceptuję.
- **Z18** — akceptuję. 6% nominalnie daje ok. 6,17% efektywnie; to
  standard, nie wymaga zmiany (opcjonalnie wspomnieć w podpowiedzi pola).
- **Z19** — akceptuję po rozstrzygnięciu D2.

## 5. Uwagi nieblokujące

1. Status na początku SPEC nadal wylicza „powiadomienia e-mail” w zakresie
   Etapu 2 (zdanie dalej mówi o wycofaniu); to samo w nagłówku STACK.
   Lepiej przenieść maile do zdania o zmianie zakresu.
2. Rozdz. 8 nadal opisuje wariant B („nawigacja na górze … przełącznik
   motywu”), a 5.7, 8.1 i scen. 46 opierają się na kierunku „Portfel”
   (boczny pasek, dolna belka). P20 zapowiadał aktualizację rozdz. 8 przez
   odświeżenie R, które jest już zmergowane bez niej. Sprzeczność sprzed tej
   zmiany, ale P30 ją pogłębia.
3. Sześć zakładek przy 360 px: belka ma 348 px, czyli ok. 58 px na zakładkę
   i ok. 54 px na nazwę 10,5 px; „Ustawienia” prawdopodobnie zostanie
   ucięte wielokropkiem (`text-overflow: ellipsis` w `MainNav.module.css`).
   8.1 mówi o „skróconych nazwach” — podać je albo dopuścić ucięcie.
4. Legenda „Wpłaty kontra zysk” pokazuje trzy części „i ich sumę”: suma
   zaokrąglonych części może różnić się o 1 zł od zaokrąglonego majątku.
   Dopisać, która kwota wygrywa (np. zysk w legendzie = zaokrąglony majątek
   − zaokrąglone pozostałe części). „Połówki w górę” dla kwot ujemnych jest
   niejednoznaczne — lepiej „od zera”, jak przy zysku miesiąca.
5. Zdanie kontrolne: odmiana „jak wyżej” odnosi się do mianownika
   („ostatnie 2 miesiące”), a zdanie używa miejscownika; brak formy dla
   jednego miesiąca („W ostatnim rozliczonym miesiącu…”).
6. Kamienie milowe: dla progu, który osiąga tylko scenariusz +5/+10/+15%,
   nie wiadomo, gdzie stoi pionowa linia z etykietą (8.1 łączy ją ze
   znacznikiem na linii bazowej).
7. Kolejność stanów „brak danych”, gdy zachodzi kilka naraz (brak
   przychodu, brak źródeł, brak kursu).
8. Tabela źródeł: co w kolumnie „pula i cel” dla źródła bez celu („Gotówka”
   w przykładzie); czy „wartość dziś” ma grosze (punkt wyjścia) czy pełne
   złote (kwoty prognozy).
9. Pole stopy: przyjmować zarówno `-`, jak i `−` (U+2212), którego używa
   komunikat.
10. Puste pole własnego horyzontu: dopisać, że zostaje bieżący wybór i nie
    ma komunikatu.
11. Czy lista źródeł na Majątku pokazuje stopę (5.2 opisuje tylko
    formularz)? Wystarczy zdanie.

## 6. Ponowne review (c916fdd)

Zakres: `git diff 79c1c8a..c916fdd -- SPEC.md` (oraz STACK i PLAN dla
spójności). Rozstrzygnięcia właściciela: D1 → stopa od −50 do 20% (P31),
D2 → wariant A, Z19 obejmuje zaległe miesiące (P32).

**Werdykt: APPROVE.**

Ustalenia blokujące:
- **B1 — rozwiązane.** 5.13 ma odmianę „Za 1 rok / 2 lata (2–4, 22–24,
  32–34) / 5 lat” — poprawna dla 1–40 (12–14 → „lat”); cztery warianty
  zdania (brak stóp, zysk > 0, < 0, = 0); udział zysku liczony tylko przy
  zysku > 0, więc majątek końcowy > 0 i dzielenie przez zero nie zachodzi;
  przy wpłacie 0 drugie zdanie pominięte; warstwy przycięte do majątku
  scenariusza. Nowe wiersze rozdz. 7 (stopy mieszane, majątek 0 i pule 0%)
  i scen. 48.
- **B2 — rozwiązane.** 5.13 („Bez danych na zewnątrz”), P27 i scen. 47
  rozróżniają żądania przeglądarki (żadnych) i pobranie kursu NBP przez
  serwer (jak na innych ekranach, bez danych użytkownika); STACK wskazuje
  `resolveCurrentRate`.
- **B3 — rozwiązane.** Dopiski „ostatni miesiąc z przychodem” / „2 ostatnie
  miesiące z przychodem” / „6 ostatnich miesięcy z przychodem” / „bieżący
  miesiąc, jeszcze niepełny” (gramatyka poprawna), wiersz rozdz. 7
  o przerwach, scen. 41 i 42 sprawdzają nowe teksty.

Decyzje: P31 wpisane w 7.1 (komunikat, minus `-` i `−`), scen. 43 („60”
odrzucone, „−10” przyjęte), STACK (CHECK −5000…2000) i PLAN T28 ✓. P32
wpisane w Z19 ✓. Z17–Z19 oznaczone jako zaakceptowane ✓.

Uwagi nieblokujące z rozdz. 5: uwzględnione 1 (status), 3 (skrócone nazwy,
„bez ucinania”), 4 (legenda, „od zera”), 5 (zdanie kontrolne dla 1
miesiąca), 6 (próg bez znacznika), 7 (kolejność stanów), 8 („bez celu”,
pełne złote w tabeli), 9 (oba minusy), 10 (puste pole), 11 (stopa na
liście). Uwaga 2 (rozdz. 8 opisuje wariant B) pozostaje otwarta i jest
jawnie zapisana w PLAN jako poza zakresem.

Przeliczone ponownie (ten sam skrypt, `BigInt`, grosze):

| Miejsce | Obliczenie | Wynik |
| --- | --- | --- |
| Scen. 48, 5 lat | „Konto” −10%: zysk miesiąca `v × (−1000) ÷ 120 000`, połówki od zera; + 2 000 zł | 55 421,27 → 55 421 zł ✓ |
| j.w., legenda | 55 421 − 12 000 − 60 000 | −16 579 zł ✓ |
| j.w., 1 rok | 22 509,57 → 22 510; 22 510 − 12 000 − 12 000 | −1 490 zł ✓ |
| j.w., 22 lata | 109 923,50 → 109 924; wpłaty 264 000 | −166 076 zł (zdanie „za 22 lata” ✓) |
| Scen. 48, zero | wartości 0, wpłata 0 | 0 zł, brak progów, zdanie „zysk … 0 zł” ✓ |
| P31 | 2 mld zł przy 20% przez 480 miesięcy | 5 581 495 985 202,74 zł < `MAX_SAFE_INTEGER` ✓ |

Nowe uwagi nieblokujące:
1. Kwota w zdaniu dla zysku ujemnego (i warunek „zysk = 0 po
   zaokrągleniu”) nie mówi wprost, że to kwota z legendy (zaokrąglony
   majątek minus zaokrąglone części). Różnica ma znaczenie przy połówkach:
   dla 22 lat w scen. 48 legenda daje 166 076 zł, a zaokrąglenie
   niezaokrąglonego zysku (−166 076,50) od zera — 166 077 zł. Dopisać
   „kwota jak w legendzie”.
2. Zysk > 0, ale udział zaokrąglony do 0% daje „0% majątku to zysk”;
   dopuszczalne, ewentualnie „mniej niż 1%”.
3. Scen. 41, 43 i 48 mają wiersze dłuższe niż reszta dokumentu
   (kosmetyka; `prettier --check` przechodzi).
