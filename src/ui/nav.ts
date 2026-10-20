export const NAV_TABS = [
  { href: "/", label: "Ten miesiąc" },
  { href: "/majatek", label: "Majątek" },
  { href: "/plan", label: "Plan podziału" },
  { href: "/historia", label: "Historia" },
  { href: "/ustawienia", label: "Ustawienia" },
] as const;

export type NavHref = (typeof NAV_TABS)[number]["href"];

/** Zakładka aktywna dla ścieżki; podstrony należą do zakładki nadrzędnej. */
export function activeTab(pathname: string): NavHref {
  const match = NAV_TABS.find(
    ({ href }) =>
      href !== "/" && (pathname === href || pathname.startsWith(`${href}/`)),
  );
  return match?.href ?? "/";
}
