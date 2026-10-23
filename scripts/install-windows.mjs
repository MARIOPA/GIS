import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
} from "node:fs";
import { resolve, dirname, join, relative, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import { appRoot } from "../server/paths.mjs";
if (process.platform !== "win32" || process.arch !== "x64")
  throw new Error("Se necesita Windows 10/11 x64.");
const target = resolve(
  process.argv[2] || join(process.env.LOCALAPPDATA, "Torrents", "0.4.0"),
);
const rel = relative(appRoot, target);
if (!rel || (!rel.startsWith("..") && !isAbsolute(rel)))
  throw new Error("Elige un destino fuera de la carpeta portable original.");
if (existsSync(target))
  throw new Error(
    `El destino ya existe. No se sobrescriben proyectos: ${target}`,
  );
mkdirSync(dirname(target), { recursive: true });
const stage = mkdtempSync(join(dirname(target), ".torrents-install-"));
const data = resolve(appRoot, ".data");
cpSync(appRoot, stage, { recursive: true, filter: (path) => path !== data });
for (const [command, args] of [
  [join(stage, "runtime/node/node.exe"), ["--version"]],
  [
    join(stage, "runtime/python/python.exe"),
    ["-c", "import rasterio,numpy,pyproj; print('Terreno disponible')"],
  ],
]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0)
    throw new Error(
      "No se ha podido iniciar el runtime. Revisa Microsoft Visual C++ x64 y conserva el mensaje de error.",
    );
}
renameSync(stage, target);
const shortcut = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    `
  $ErrorActionPreference = 'Stop'
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Torrents.lnk'))
  $link.TargetPath = Join-Path $env:TORRENTS_INSTALL_PATH 'Abrir-Torrents.cmd'
  $link.WorkingDirectory = $env:TORRENTS_INSTALL_PATH
  $link.Save()
`,
  ],
  { stdio: "inherit", env: { ...process.env, TORRENTS_INSTALL_PATH: target } },
);
if (shortcut.status !== 0)
  console.log(
    "No se ha creado el acceso directo. Puedes abrir Abrir-Torrents.cmd en la carpeta instalada.",
  );
console.log(
  `Instalado en ${target}\nAbre Importar-MDT.cmd para cargar la superficie y después Abrir-Torrents.cmd.`,
);
