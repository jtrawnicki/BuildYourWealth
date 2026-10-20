import type { Metadata } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { THEME_SCRIPT } from "@/ui/theme";
import "@/ui/tokens.css";
import "./globals.css";

const sora = Sora({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sora",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "BuildYourWealth",
  description:
    "Miesięczny plan podziału przychodów na oszczędności i inwestycje.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning: THEME_SCRIPT dodaje data-theme przed hydracją.
  return (
    <html
      lang="pl"
      className={`${sora.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
