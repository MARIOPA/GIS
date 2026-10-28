@echo off
setlocal
cd /d "%~dp0"
for %%I in ("%~dp0.") do set "TORRENTS_ROOT=%%~fI"

echo Reconstruyendo y verificando Torrents 0.2.0...
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $name='torrents-windows-listo-con-mdt-0.2.0.zip'; $expected='74909fb90ff17156f7f2689ba42bc206afed7cd7e807f2fe8e09ccc7d8b0a3f5'; $parts=Get-ChildItem -LiteralPath '.\windows' -Filter ($name+'.parte-*') | Sort-Object Name; if ($parts.Count -ne 3) { throw 'Falta alguna de las tres partes de la aplicacion.' }; $output=Join-Path (Get-Location) $name; $target=[IO.File]::Open($output,[IO.FileMode]::Create,[IO.FileAccess]::Write); try { foreach ($part in $parts) { $source=[IO.File]::OpenRead($part.FullName); try { $source.CopyTo($target) } finally { $source.Dispose() } } } finally { $target.Dispose() }; $actual=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant(); if ($actual -ne $expected) { Remove-Item -LiteralPath $output -Force; throw ('La descarga esta incompleta o danada. SHA-256 obtenido: '+$actual) }"
if errorlevel 1 (
  echo.
  echo No se ha podido reconstruir la aplicacion. Comprueba la carpeta windows.
  pause
  exit /b 1
)

echo Descomprimiendo la aplicacion. No cierres esta ventana...
tar.exe -xf "%TORRENTS_ROOT%\torrents-windows-listo-con-mdt-0.2.0.zip" -C "%TORRENTS_ROOT%"
if errorlevel 1 (
  echo.
  echo Windows no ha podido descomprimir el paquete.
  echo Mueve la carpeta GIS-downloads a C:\Torrents y vuelve a intentarlo.
  pause
  exit /b 1
)

echo.
echo Aplicacion y MDT preparados correctamente.
start "" "%TORRENTS_ROOT%\torrents-portable-windows-x64-0.2.0\Abrir-Torrents.cmd"
exit /b 0
