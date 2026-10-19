# Uniwersalny workflow pracy nad projektem z agentami AI

> Stan procesu w tym repozytorium: **etapy A i B zakończone**, `SPEC.md` bez otwartych pytań;
> następny krok: etap C (projekt techniczny, `STACK.md`).

## 1. Cel

Proces ma dostarczać działające, zweryfikowane oprogramowanie bez ciągłego
obserwowania agentów przez człowieka. Szczegółowe wymagania i zadania dają
agentom kontekst, ale liczba rytuałów pozostaje proporcjonalna do ryzyka.

Workflow jest przeznaczony do różnych projektów programistycznych. Elementy
zależne od stosu, produktu i sposobu wdrożenia należy dopisać w dokumentacji
konkretnego repozytorium.

## 2. Podział odpowiedzialności

### Człowiek

Podejmuje decyzje dotyczące:

- problemu, użytkownika, zakresu i kryteriów sukcesu;
- wyglądu i doświadczenia użytkownika;
- kompromisów produktowych;
- istotnych zmian danych lub architektury;
- działań trudnych do odwrócenia;
- świadomego zaakceptowania istotnego ryzyka.

### Agenci

Samodzielnie odpowiadają za:

- analizę repozytorium i dokumentacji;
- projekt techniczny w zatwierdzonych granicach;
- implementację i testy;
- niezależne review;
- poprawki wynikające z review;
- rutynowe operacje Git i aktualizację trackera;
- merge spełniający uzgodnione warunki;
- zwięzły raport końcowy.

Role są logiczne. Nie trzeba używać osobnego modelu dla każdej roli, ale
implementer nie powinien wykonywać jedynego review własnej zmiany.

## 3. Artefakty i źródła prawdy

| Artefakt                           | Odpowiada na pytanie                                 |
| ---------------------------------- | ---------------------------------------------------- |
| `SPEC.md`                          | Co i dla kogo budujemy?                              |
| `STACK.md` lub dokument techniczny | Jakie trwałe decyzje techniczne obowiązują?          |
| `PLAN.md` i Issues                 | W jakiej kolejności oraz po czym poznamy ukończenie? |
| `AGENTS.md`                        | Jak agenci mają pracować w tym repozytorium?         |
| testy i scenariusze akceptacyjne   | Jak dowodzimy, że zachowanie jest poprawne?          |

Nie kopiuj tej samej reguły do wszystkich dokumentów. W razie konfliktu agent
ma go zgłosić, a nie samodzielnie wybrać wygodniejszą wersję.

## 4. Proces od pomysłu do wydania

### Etap A — discovery

1. Agent prowadzi wywiad w kilku krótkich rundach.
2. Najpierw ustala problem, użytkownika i oczekiwany rezultat, później funkcje.
3. Rozpoznaje przepływy, przypadki brzegowe, dane, ograniczenia, ryzyka i zakres
   poza MVP.
4. Dla produktu z UI ustala kierunek wizualny za pomocą przykładów, makiet,
   prototypu albo wariantów.
5. Rozdziela fakty, założenia, decyzje i otwarte pytania.
6. Dopiero po wywiadzie przygotowuje `SPEC.md`.

**Brama:** człowiek potwierdza, że dokument opisuje właściwy produkt.

### Etap B — niezależne review specyfikacji

Drugi agent sprawdza:

- luki i sprzeczności;
- niejednoznaczne wymagania;
- brakujące scenariusze błędów;
- ukryte decyzje produktowe;
- wymagania nieweryfikowalne;
- niepotrzebny zakres;
- elementy wizualne pozostawiające zbyt dużo miejsca na interpretację.

Autor poprawia specyfikację. Człowiek rozstrzyga tylko decyzje produktowe.

**Brama:** brak blokujących pytań w `SPEC.md`.

### Etap C — najprostszy projekt techniczny

1. Agent analizuje zatwierdzoną specyfikację i istniejące repozytorium.
2. Preferuje używany stos, standardowe mechanizmy i małą liczbę zależności.
3. Porównuje alternatywy tylko wtedy, gdy wybór ma istotne konsekwencje.
4. Nie projektuje funkcji „na przyszłość”, jeśli nie są potrzebne do MVP.
5. Dla największej niewiadomej może zaproponować ograniczony spike z kryterium
   zakończenia i planem usunięcia kodu eksperymentalnego.
6. Zapisuje decyzje w `STACK.md` lub odpowiednim dokumencie technicznym.

**Brama człowieka:** tylko decyzje produktowe, dane, istotne zależności,
trudne do zmiany granice systemu albo wyraźny wzrost kosztu.

### Etap D — plan wykonania

Agent zamienia `SPEC.md` i projekt techniczny na:

- małe, niezależnie weryfikowalne zadania;
- jawne zależności;
- wczesne zadania redukujące największe ryzyko;
- milestone'y opisujące działający przyrost produktu;
- kryteria akceptacji i sposób weryfikacji każdego zadania;
- oznaczenie zadań, które można bezpiecznie wykonywać równolegle.

Zadanie implementacyjne powinno opisywać rezultat, a nie szczegółowy zapis kodu,
chyba że konkretna decyzja została już zatwierdzona w architekturze.

### Etap E — krytyczne review planu

Niezależny agent sprawdza plan pod kątem:

- scope creep;
- overengineeringu;
- przedwczesnych abstrakcji i infrastruktury;
- zbędnych zależności;
- złej kolejności;
- zadań zbyt dużych lub zbyt drobnych;
- brakującej weryfikacji ryzyk;
- eksperymentów bez planu wyjścia;
- decyzji, które powinien podjąć człowiek.

**Brama:** plan jest wykonalny, minimalny i prowadzi do kryteriów akceptacji ze
specyfikacji.

### Etap F — autonomiczna pętla implementacyjna

Dla każdego zadania:

1. Sprawdź zależności, źródła prawdy i stan repozytorium.
2. Określ poziom ryzyka oraz wymagany zakres weryfikacji.
3. Utwórz branch lub worktree dla znaczącej zmiany.
4. Zaimplementuj wyłącznie uzgodniony zakres wraz z testami.
5. Uruchom odpowiednią bramkę jakości.
6. Zleć niezależne review, jeśli wymaga tego poziom ryzyka.
7. Implementer odnosi się do każdej uwagi blokującej: poprawia ją albo jasno
   uzasadnia odrzucenie.
8. Reviewer sprawdza poprawki, gdy zmieniają one istotę rozwiązania.
9. Agent wykonuje merge, jeśli spełnione są wszystkie warunki automatycznego
   merge'u.
10. Zamyka Issue, aktualizuje milestone i dokumentację oraz usuwa tymczasowe
    artefakty.

Człowiek nie musi obserwować pracy. Agent kontaktuje się z nim tylko przy
rzeczywistej decyzji albo blokadzie.

### Etap G — zamknięcie milestone'u lub wydania

1. Uruchom pełną bramkę jakości.
2. Wykonaj ręczny scenariusz akceptacyjny.
3. Zleć niezależne review zgodności ze specyfikacją.
4. Dla ryzykownego wydania wykonaj dodatkowy audyt eksploracyjny, który nie
   zakłada poprawności dotychczasowych testów.
5. Sprawdź środowisko docelowe, obserwowalność, dane, bezpieczeństwo i procedurę
   wycofania, jeśli mają zastosowanie.
6. Po wdrożeniu wykonaj smoke test.
7. Zamknij Issues i milestone'y, zapisz świadomie odłożony backlog i upewnij się,
   że repozytorium opisuje rzeczywisty stan produktu.

## 5. Trzy poziomy weryfikacji

### Poziom 1 — mała zmiana

Przykłady: tekst, mały styl, lokalna korekta bez zmiany kontraktu.

Minimum:

- testy zmienionego obszaru;
- lint;
- typecheck, jeśli istnieje;
- kontrola formatowania;
- szybka inspekcja diffu.

Niezależne review jest opcjonalne. Drobne zmiany można grupować.

### Poziom 2 — funkcja lub istotna poprawka

Przykłady: nowy przepływ, zmiana stanu, danych, zachowania API lub integracji.

Minimum:

- pełne testy jednostkowe i integracyjne;
- build;
- testy zachowania użytkownika adekwatne do zmiany;
- niezależne review;
- ponowne sprawdzenie po poprawkach.

### Poziom 3 — milestone lub wydanie

Minimum:

- pełna bramka projektu;
- E2E krytycznych przepływów;
- ręczny scenariusz akceptacyjny;
- review zgodności ze specyfikacją;
- niezależny audyt całości dla ryzykownego wydania;
- smoke test środowiska docelowego.

## 6. Polityka niezależnego review

Niezależne review jest obowiązkowe dla:

- funkcji i istotnych poprawek;
- zmian danych, bezpieczeństwa, uprawnień i prywatności;
- złożonego stanu, współbieżności i integracji;
- krytycznej dostępności;
- migracji i trudnych do odwrócenia zmian;
- kodu opartego na niezweryfikowanym zachowaniu biblioteki;
- milestone'ów i wydań.

Raport review ma format:

1. **Werdykt:** `APPROVE`, `REQUEST CHANGES` albo `HUMAN DECISION`.
2. **Decyzje wymagane od człowieka:** pusta lista albo konkretne pytania.
3. **Problemy blokujące:** tylko problemy wymagane przed merge'em.
4. **Weryfikacja:** co reviewer sam sprawdził.
5. **Uwagi nieblokujące:** krótka lista, bez automatycznego rozszerzania zakresu.

Reviewer ma szukać błędów, a nie potwierdzać narrację implementera. Powinien
przejrzeć wymagania i diff oraz samodzielnie odtworzyć najbardziej ryzykowne
zachowanie.

## 7. Warunki automatycznego merge'u

Agent może wykonać merge bez kolejnego potwierdzenia człowieka, gdy:

- wszystkie wymagane kontrole przeszły;
- niezależny reviewer wydał `APPROVE`, jeśli review było wymagane;
- rozwiązano wszystkie uwagi blokujące;
- branch jest aktualny i mergeowalny;
- nie istnieje otwarta decyzja wymagająca człowieka;
- zmiana nie wprowadza niezatwierdzonej zmiany produktu, UX ani zakresu;
- Issue, dokumentacja i plan mogą zostać spójnie zaktualizowane.

## 8. Kiedy wrócić do planowania

Przerwij implementację i wróć do specyfikacji albo projektu technicznego, gdy:

- wymagane jest zmienienie `SPEC.md`;
- pojawia się nowa decyzja produktowa;
- rozwiązanie zależy od niezweryfikowanego zachowania narzędzia lub biblioteki;
- podstawowy przepływ ma nierozwiązane ryzyko;
- zmiana jest znacznie większa niż przewidywało zadanie;
- potrzebna jest nowa istotna zależność lub warstwa systemu;
- prototyp wizualny nie spełnia oczekiwań;
- implementacja wymaga obchodzenia testów, typowania, bezpieczeństwa lub
  dostępności.

Agent opisuje wtedy: wykryty fakt, wpływ, możliwe warianty i rekomendację. Nie
kontynuuje na podstawie ukrytego założenia.

## 9. Praca wielu agentów

### Kiedy równoleglić

Równolegle wykonuj tylko zadania, które:

- nie są od siebie zależne;
- mają stabilny wspólny kontrakt;
- nie wymagają częstych zmian tych samych plików;
- można oddzielnie przetestować i zreviewować.

### Zasady

- Każdy agent pracuje na osobnym branchu lub worktree.
- Każde zadanie ma jednego właściciela.
- Plan wskazuje spodziewane obszary zmian i zależności.
- Jeden agent pełni rolę integratora.
- Po połączeniu równoległych zmian uruchamiana jest bramka integracyjna.
- Konflikt w źródłach prawdy albo wspólnym kontrakcie zatrzymuje pracę.
- Na początku ogranicz równoległość do dwóch lub trzech zadań i zwiększaj ją
  dopiero po potwierdzeniu, że integracja jest tańsza niż zysk czasu.

## 10. Raport końcowy implementera

Raport powinien być krótki i zaczynać się od wyniku:

1. **Rezultat:** co działa i gdzie znajduje się zmiana.
2. **Decyzje wymagane od człowieka:** tylko jeśli istnieją.
3. **Weryfikacja:** wykonane kontrole i ich rzeczywiste wyniki.
4. **Review:** werdykt niezależnego agenta i sposób rozwiązania uwag.
5. **Ryzyka lub pominięte kontrole:** wyłącznie nadal aktualne.
6. **Stan procesu:** merge, Issue, milestone, deployment.

Nie powtarzaj całego diffu ani nie ukrywaj istotnego ryzyka w środku długiego
opisu.

## 11. Definicja ukończenia projektu

Projekt albo wydanie jest ukończone, gdy:

- kryteria akceptacji są spełnione;
- wymagane kontrole przechodzą;
- wykonano niezależne review odpowiednie do ryzyka;
- produkt działa w środowisku docelowym;
- nie ma nierozstrzygniętych decyzji ani ukrytych blokerów;
- dokumentacja opisuje faktyczny stan;
- Issues i milestone'y są zamknięte albo świadomie przeniesione do backlogu;
- tymczasowy kod, spike'i i serwery zostały usunięte lub świadomie zachowane;
- dalsze pomysły są oddzielone od ukończonego zakresu.

## 12. Retrospektywa

Po wydaniu odpowiedz krótko:

- co przyspieszyło pracę;
- co wymagało interwencji człowieka;
- jaki problem ominął testy i review;
- które instrukcje były użyteczne;
- co można usunąć z procesu;
- które decyzje powinny być następnym razem podjęte wcześniej.

Aktualizuj workflow na podstawie dowodów, nie pojedynczych preferencji agenta.
