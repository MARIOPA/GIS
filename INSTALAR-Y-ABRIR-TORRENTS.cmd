@echo off
setlocal EnableExtensions
cd /d "%~dp0"
for %%I in ("%~dp0.") do set "TORRENTS_ROOT=%%~fI"

set "APP_NAME=torrents-portable-windows-x64-0.2.0"
set "APP_ZIP=%TORRENTS_ROOT%\torrents-windows-listo-con-mdt-0.2.0.zip"
set "UPDATE_ZIP=%TORRENTS_ROOT%\updates\0.5.0\actualizacion-torrents-0.5.0.zip"
set "TORRENTS_UPDATE_DIR=%TORRENTS_ROOT%\actualizacion-torrents-0.5.0\update-0.5"

echo.
echo TORRENTS 0.5.0 - INSTALACION AUTOMATICA
echo =======================================
echo Preparando la aplicacion. No cierres esta ventana...

if exist "%TORRENTS_ROOT%\%APP_NAME%\Abrir-Torrents.cmd" goto actualizar

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $name='torrents-windows-listo-con-mdt-0.2.0.zip'; $expected='74909fb90ff17156f7f2689ba42bc206afed7cd7e807f2fe8e09ccc7d8b0a3f5'; $parts=Get-ChildItem -LiteralPath '.\windows' -Filter ($name+'.parte-*') | Sort-Object Name; if ($parts.Count -ne 3) { throw 'Falta alguna de las tres partes de la aplicacion.' }; $output=Join-Path (Get-Location) $name; $target=[IO.File]::Open($output,[IO.FileMode]::Create,[IO.FileAccess]::Write); try { foreach ($part in $parts) { $source=[IO.File]::OpenRead($part.FullName); try { $source.CopyTo($target) } finally { $source.Dispose() } } } finally { $target.Dispose() }; $actual=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant(); if ($actual -ne $expected) { Remove-Item -LiteralPath $output -Force; throw ('La descarga esta incompleta o danada. SHA-256 obtenido: '+$actual) }"
if errorlevel 1 goto error_preparar

echo Descomprimiendo Torrents...
tar.exe -xf "%APP_ZIP%" -C "%TORRENTS_ROOT%"
if errorlevel 1 goto error_extraer
if not exist "%TORRENTS_ROOT%\%APP_NAME%\Abrir-Torrents.cmd" goto error_extraer

:actualizar
if not exist "%UPDATE_ZIP%" goto error_actualizacion
echo Instalando la version 0.5.0 y el MDT...
tar.exe -xf "%UPDATE_ZIP%" -C "%TORRENTS_ROOT%"
if errorlevel 1 goto error_actualizacion
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Get-ChildItem -LiteralPath $env:TORRENTS_UPDATE_DIR -Recurse -File | Unblock-File; & (Join-Path $env:TORRENTS_UPDATE_DIR 'actualizar.ps1')"
if errorlevel 1 goto error_actualizacion

echo.
echo Torrents 0.5.0 se ha preparado correctamente y se abrira ahora.
pause
exit /b 0

:error_preparar
echo.
echo No se ha podido reconstruir la aplicacion. Comprueba que descargaste la carpeta completa.
pause
exit /b 1

:error_extraer
echo.
echo Windows no ha podido descomprimir la aplicacion.
echo Conserva esta ventana y comunica el mensaje mostrado arriba.
pause
exit /b 1

:error_actualizacion
echo.
echo No se ha podido instalar la actualizacion 0.5.0.
echo Comprueba que existe la carpeta updates\0.5.0 y conserva el mensaje mostrado arriba.
pause
exit /b 1
