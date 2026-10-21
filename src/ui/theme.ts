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

const listeners = new Set<() => void>();

/**
 * Zapamiętuje wybór motywu w ciasteczku i od razu go pokazuje; `undefined`
 * oznacza motyw systemowy (usuwa ciasteczko). Powiadamia subskrybentów, żeby
 * przycisk w nagłówku i wybór w Ustawieniach pokazywały ten sam stan.
 */
export function saveTheme(theme: Theme | undefined) {
  document.cookie = theme
    ? `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
    : `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

/** Subskrypcja zmian motywu dla `useSyncExternalStore`. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ustawia motyw z ciasteczka przed pierwszym malowaniem (STACK 5, „Motyw”). */
export const THEME_SCRIPT = `try{var m=new RegExp(${JSON.stringify(THEME_PATTERN)}).exec(document.cookie);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;
