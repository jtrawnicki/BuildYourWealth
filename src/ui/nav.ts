export const NAV_TABS = [
  { href: "/", label: "Ten miesiąc", short: "Miesiąc" },
  { href: "/majatek", label: "Majątek", short: "Majątek" },
  { href: "/plan", label: "Plan podziału", short: "Plan" },
  { href: "/historia", label: "Historia", short: "Historia" },
  { href: "/ustawienia", label: "Ustawienia", short: "Ustawienia" },
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
