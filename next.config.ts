import type { NextConfig } from "next";

// Nagłówki bezpieczeństwa (OWASP 2025 A02). CSP opieramy na `'unsafe-inline'`
// dla skryptów i stylów, bo nonce wymaga renderowania dynamicznego i jest
// niezgodny z PPR (`cacheComponents`), a czysty CSP na hashach nie przetrwałby
// buildów: bootstrap Turbopacka (`<script id="_R_">`) zawiera nazwy chunków
// zmienne co build, a komponenty pasków używają inline `style`. To wariant
// „Without Nonces" z przewodnika Next; XSS i tak ogranicza React (escaping)
// oraz brak wejścia użytkownika w jedynym własnym skrypcie inline (motyw).
const isDev = process.env.NODE_ENV !== "production";

// HSTS i wymuszanie HTTPS tylko w trybie demo (HTTPS na Vercel). Wersja
// prywatna działa po HTTP na 127.0.0.1, gdzie `upgrade-insecure-requests`
// zepsułby ładowanie podzasobów `/_next/...`, a HSTS i tak jest ignorowany.
const isHttpsDeployment = process.env.APP_MODE === "demo";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  // `'unsafe-eval'` tylko w dev (React Refresh); produkcja go nie potrzebuje.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // `ws:` tylko w dev dla Hot Module Replacement.
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "manifest-src 'self'",
  ...(isHttpsDeployment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  ...(isHttpsDeployment
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Nie zdradzaj użytego frameworka (OWASP 2025 A02).
  poweredByHeader: false,
  // Wersja prywatna buduje się do osobnego katalogu (`npm run private:start`),
  // więc build do testów nie podmienia plików działającemu serwerowi.
  distDir: process.env.BYW_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
