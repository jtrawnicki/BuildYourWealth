import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Wersja prywatna buduje się do osobnego katalogu (`npm run private:start`),
  // więc build do testów nie podmienia plików działającemu serwerowi.
  distDir: process.env.BYW_DIST_DIR || ".next",
};

export default nextConfig;
