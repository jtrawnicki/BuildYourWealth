export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

/** Motyw zapisany w ciasteczku; brak lub nieznana wartość oznacza systemowy. */
export function themeFromCookies(cookies: string): Theme | undefined {
  for (const pair of cookies.split(";")) {
    const [name, value] = pair.trim().split("=");
    if (name === THEME_COOKIE && (value === "light" || value === "dark")) {
      return value;
    }
  }
  return undefined;
}

export function applyTheme(theme: Theme | undefined) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/**
 * Skrypt w <head> ustawia motyw z ciasteczka przed pierwszym malowaniem,
 * tak samo jak themeFromCookies. Odczyt w root layoutcie przez cookies()
 * zablokowałby prerendering wszystkich stron (Cache Components).
 */
export const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;
