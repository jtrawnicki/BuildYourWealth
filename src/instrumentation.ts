import { appMode } from "@/demo/mode";

// Wołane raz przy starcie serwera, zanim obsłuży pierwsze żądanie. Niedozwolony
// tryb (np. brak APP_MODE=demo na Vercel) przerywa start zamiast wystawić
// aplikację (STACK 5 „Tryby aplikacji”).
export function register(): void {
  appMode();
}
