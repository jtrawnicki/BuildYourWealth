import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// Format zapisu: scrypt$N$r$p$sól$skrót (base64), żeby parametry dało się
// później podnieść bez unieważniania istniejących haseł.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFC"),
      salt,
      KEY_LENGTH,
      { ...options, maxmem: 128 * options.N! * options.r! * 2 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, PARAMS);
  const { N, r, p } = PARAMS;
  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, N, r, p, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !hash) {
    return false;
  }
  const expected = Buffer.from(hash, "base64");
  let key: Buffer;
  try {
    key = await derive(password, Buffer.from(salt, "base64"), {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    // Uszkodzony zapis (np. nieprawidłowe parametry) nie pasuje do żadnego hasła.
    return false;
  }
  return key.length === expected.length && timingSafeEqual(key, expected);
}
