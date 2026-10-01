@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-visit-manager.ps1" %*

if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar o Visit Manager.
  pause
)
