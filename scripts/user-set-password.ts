import { hashPassword } from "@/auth/password";
import { closePool, getDb } from "@/db/client";
import { normalizeEmail, setUserPassword } from "@/db/users";
import { readPassword } from "./read-password";
import { loadEnv } from "./load-env";

// Użycie: npm run user:set-password -- <email>
// Hasło jest wczytywane z terminala (bez echa) albo ze standardowego wejścia.
const MIN_PASSWORD_LENGTH = 12;

function validateInput(
  email: string | undefined,
  password: string,
): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+$/.test(normalizeEmail(email))) {
    return "Podaj adres e-mail: npm run user:set-password -- <email>";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków.`;
  }
  return null;
}

async function main(): Promise<void> {
  loadEnv();
  const email = process.argv[2];
  const emailError = validateInput(email, "x".repeat(MIN_PASSWORD_LENGTH));
  if (emailError) {
    throw new Error(emailError);
  }
  const password = await readPassword();
  const error = validateInput(email, password);
  if (error) {
    throw new Error(error);
  }
  const { created } = await setUserPassword(
    getDb(),
    email,
    await hashPassword(password),
  );
  console.log(
    created
      ? `Utworzono konto ${normalizeEmail(email)}.`
      : `Ustawiono nowe hasło dla ${normalizeEmail(email)}; sesje zostały unieważnione.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
