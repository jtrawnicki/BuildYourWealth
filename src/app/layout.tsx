import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildYourWealth",
  description:
    "Miesięczny plan podziału przychodów na oszczędności i inwestycje.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
