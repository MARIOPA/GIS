import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { openStore } from "../server/store.mjs";
import { passwordHash } from "../server/app.mjs";
if (!process.stdin.isTTY) {
  console.error(
    "Ejecuta este comando en una terminal interactiva. No pases contraseñas como argumentos.",
  );
  process.exit(1);
}
let muted = false;
const output = new Writable({
  write(chunk, encoding, cb) {
    if (!muted) process.stdout.write(chunk, encoding);
    cb();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: true });
try {
  const name = (await rl.question("Usuario: ")).trim();
  if (!/^[\w.@-]{3,100}$/.test(name))
    throw new Error(
      "Usa entre 3 y 100 caracteres: letras, números, punto, @, _ o guion.",
    );
  process.stdout.write("Contraseña (mínimo 12 caracteres): ");
  muted = true;
  const password = await rl.question("");
  muted = false;
  process.stdout.write("\n");
  if (password.length < 12)
    throw new Error("La contraseña debe tener al menos 12 caracteres.");
  const db = openStore();
  if (db.prepare("SELECT id FROM users WHERE id=?").get(name))
    throw new Error("El usuario ya existe; no se ha modificado.");
  db.prepare("INSERT INTO users VALUES (?,?,?)").run(
    name,
    name,
    passwordHash(password),
  );
  db.close();
  console.log("Usuario creado. Inicia sesión desde la aplicación.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
