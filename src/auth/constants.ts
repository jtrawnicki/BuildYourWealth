// Stałe logowania bez zależności serwerowych, żeby mogły ich używać także
// komponenty klienckie i testy E2E działające w Node.

export const SESSION_COOKIE = "byw_session";
export const LOGIN_PATH = "/logowanie";

// Ważność sesji: 30 dni (STACK 5).
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Ochrona przed zgadywaniem hasła: po tylu nieudanych próbach adres jest
// blokowany na czas blokady (STACK 5). Tu, bez zależności serwerowych, bo
// korzystają z nich także testy E2E.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

// Komunikaty logowania. „Nieprawidłowy” nie zdradza, czy konto istnieje;
// komunikat blokady nie zależy od istnienia konta (SPEC 5.1, STACK 5).
export const INVALID_CREDENTIALS_MESSAGE = "Nieprawidłowy e-mail lub hasło.";
export const LOCKED_MESSAGE =
  "Zbyt wiele nieudanych prób logowania. Odczekaj kilkanaście minut i spróbuj ponownie.";
