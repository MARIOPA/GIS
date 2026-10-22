import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { appRoot } from "../server/paths.mjs";
let source = process.argv[2];
if (!source) {
  const selection = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = 'Selecciona el ZIP del MDT descargado de SharePoint'
    $dialog.Filter = 'Superficie Torrents (*.zip)|*.zip'
    if ($dialog.ShowDialog() -eq 'OK') { [Console]::Write($dialog.FileName) }
  `,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (selection.error || selection.status !== 0) {
    console.error(
      "No se ha abierto el selector. Puedes importar indicando la ruta del ZIP como argumento.",
      selection.stderr || "",
    );
    process.exit(1);
  }
  source = selection.stdout.trim();
  if (!source) process.exit(0);
}
const result = spawnSync(
  process.execPath,
  [resolve(appRoot, "scripts/surface.mjs"), source],
  { stdio: "inherit" },
);
if (result.status === 0)
  console.log("Superficie importada. Cierra y vuelve a abrir Torrents.");
process.exit(result.status ?? 1);
