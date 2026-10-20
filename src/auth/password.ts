import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Format zapisu: scrypt$N$r$p$sól$hash (base64url). Weryfikacja przyjmuje tylko
// bieżące parametry, więc uszkodzony albo obcy zapis nie wymusi kosztownego
// ani pustego porównania; po zmianie parametrów hasło ustawia się od nowa
// skryptem `user:set-password`.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = `scrypt$${N}$${R}$${P}$`;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      KEY_LENGTH,
      { N, r: R, p: P, maxmem: 256 * N * R },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt);
  return `${PREFIX}${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (!stored.startsWith(PREFIX)) {
    return false;
  }
  const [salt, hash, ...rest] = stored.slice(PREFIX.length).split("$");
  const saltBytes = Buffer.from(salt ?? "", "base64url");
  const expected = Buffer.from(hash ?? "", "base64url");
  if (
    rest.length > 0 ||
    saltBytes.length !== SALT_LENGTH ||
    expected.length !== KEY_LENGTH
  ) {
    return false;
  }
  const key = await derive(password, saltBytes);
  return timingSafeEqual(key, expected);
}
