import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Format zapisu: scrypt$N$r$p$sól$hash (base64url), żeby parametry dało się
// zmienić bez unieważniania istniejących haseł.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keyLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLength,
      { N: n, r, p, maxmem: 256 * n * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, N, R, P, KEY_LENGTH);
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(
    password,
    Buffer.from(salt, "base64url"),
    Number(n),
    Number(r),
    Number(p),
    expected.length,
  );
  return timingSafeEqual(key, expected);
}
