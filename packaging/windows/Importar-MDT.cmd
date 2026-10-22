@echo off
setlocal
"%~dp0runtime\node\node.exe" "%~dp0scripts\pick-surface.mjs" %*
pause
