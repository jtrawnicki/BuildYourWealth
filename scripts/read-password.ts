import { stdin, stdout } from "node:process";

/** Pierwsza linia standardowego wejścia (np. `echo "$HASLO" | npm run …`). */
async function readLine(): Promise<string> {
  let data = "";
  for await (const chunk of stdin) {
    data += chunk;
  }
  return data.split(/\r?\n/)[0];
}

/** Wczytuje hasło z terminala bez wyświetlania znaków. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let value = "";
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (char === "\u0003" || char === "\u0004") {
          finish();
          reject(new Error("Przerwano."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = [...value].slice(0, -1).join("");
        } else {
          value += char;
        }
      }
    };
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    stdin.on("data", onData);
  });
}

export async function readPassword(): Promise<string> {
  if (!stdin.isTTY) {
    return readLine();
  }
  const password = await promptHidden("Nowe hasło: ");
  const repeated = await promptHidden("Powtórz hasło: ");
  if (password !== repeated) {
    throw new Error("Hasła się różnią.");
  }
  return password;
}
