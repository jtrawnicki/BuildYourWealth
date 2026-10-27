import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { THEME_SCRIPT } from "@/ui/theme";
import "@/ui/tokens.css";
import "./globals.css";

// Jeden krój dla całej aplikacji (styl „Portfel"): Manrope, zmienny font
// z pełnym zakresem grubości, więc nie trzeba podawać listy wag.
const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "BuildYourWealth",
  description:
    "Miesięczny plan podziału przychodów na oszczędności i inwestycje.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning: THEME_SCRIPT dodaje data-theme przed hydracją.
  return (
    <html lang="pl" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
