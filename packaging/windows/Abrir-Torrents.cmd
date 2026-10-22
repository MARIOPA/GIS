@echo off
setlocal
cd /d "%~dp0"
"%~dp0runtime\node\node.exe" "%~dp0scripts\launch-local.mjs"
pause
