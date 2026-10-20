export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";

const THEME_PATTERN = `(?:^|;\\s*)${THEME_COOKIE}=(light|dark)(?:;|$)`;

/** Motyw zapisany w ciasteczku; brak lub nieznana wartość oznacza systemowy. */
export function themeFromCookies(cookies: string): Theme | undefined {
  const match = new RegExp(THEME_PATTERN).exec(cookies);
  return match ? (match[1] as Theme) : undefined;
}

export function applyTheme(theme: Theme | undefined) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

/** Ustawia motyw z ciasteczka przed pierwszym malowaniem (STACK 5, „Motyw”). */
export const THEME_SCRIPT = `try{var m=new RegExp(${JSON.stringify(THEME_PATTERN)}).exec(document.cookie);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;
