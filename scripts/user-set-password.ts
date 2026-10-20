// Użycie: npm run user:set-password -- <email>
// Hasło jest wczytywane z terminala bez wyświetlania (albo z pierwszej linii
// standardowego wejścia, gdy nie jest terminalem), nigdy z argumentów.
import { loadEnvConfig } from "@next/env";
import { closePool, getDb } from "@/db/client";
import { normalizeEmail, setUserPassword } from "@/db/users";

loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

function readHidden(prompt: string): Promise<string> {
  const { stdin, stderr } = process;
  stderr.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          finish();
          reject(new Error("Przerwano."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write("\n");
    };
    stdin.on("data", onData);
  });
}

async function readFirstLine(): Promise<string> {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input.split(/\r?\n/)[0];
}

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    return readFirstLine();
  }
  const password = await readHidden("Nowe hasło: ");
  const repeated = await readHidden("Powtórz hasło: ");
  if (password !== repeated) {
    throw new Error("Hasła się różnią.");
  }
  return password;
}

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email || process.argv.length > 3) {
    throw new Error("Użycie: npm run user:set-password -- <email>");
  }
  const password = await readPassword();
  const { created } = await setUserPassword(getDb(), email, password);
  const account = normalizeEmail(email);
  console.log(
    created
      ? `Utworzono konto ${account}.`
      : `Zmieniono hasło konta ${account}; jego sesje zostały unieważnione.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closePool);
