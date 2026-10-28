"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, type NavHref, activeTab } from "./nav";
import styles from "./MainNav.module.css";

// Każda zakładka ma ikonę i widoczną nazwę. Na dolnej belce telefonu brakuje
// miejsca na pełne nazwy, więc pokazujemy skróconą; `aria-label` trzyma pełną
// nazwę zakładki niezależnie od tego, który wariant jest widoczny.
const ICONS: Record<NavHref, ReactNode> = {
  "/": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
    </>
  ),
  "/majatek": <path d="M3 20h18M6 20V9m4 11V5m4 15v-8m4 8V7" />,
  "/plan": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9l6 4" />
    </>
  ),
  "/historia": (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  "/ustawienia": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.5m0 15V22M4.2 4.2l1.8 1.8m12 12 1.8 1.8M2 12h2.5m15 0H22M4.2 19.8l1.8-1.8m12-12 1.8-1.8" />
    </>
  ),
};

export function MainNav({ className }: { className?: string }) {
  const active = activeTab(usePathname());

  return (
    <nav
      aria-label="Menu główne"
      className={`${styles.nav} ${className ?? ""}`}
    >
      {NAV_TABS.map(({ href, label, short }) => (
        <Link
          key={href}
          href={href}
          className={styles.tab}
          aria-current={href === active ? "page" : undefined}
          aria-label={label}
        >
          <svg
            className={styles.icon}
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ICONS[href]}
          </svg>
          <span className={styles.label}>{label}</span>
          <span className={styles.short}>{short}</span>
        </Link>
      ))}
    </nav>
  );
}
