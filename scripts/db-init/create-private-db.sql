-- Uruchamiany przez obraz postgres przy pierwszym starcie kontenera z `compose.yaml`.
-- Baza wersji prywatnej (STACK 5); na istniejącym wolumenie tworzy ją `npm run private:start`.
CREATE DATABASE byw_private OWNER byw;
