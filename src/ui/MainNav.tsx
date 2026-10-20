"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, activeTab } from "./nav";
import styles from "./MainNav.module.css";

export function MainNav({ className }: { className?: string }) {
  const active = activeTab(usePathname());

  return (
    <nav
      aria-label="Menu główne"
      className={`${styles.nav} ${className ?? ""}`}
    >
      {NAV_TABS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={styles.tab}
          aria-current={href === active ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
