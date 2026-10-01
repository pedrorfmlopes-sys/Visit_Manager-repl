@echo off
cd /d "%~dp0"

if not exist ".env" (
  echo [erro] ficheiro .env nao encontrado
  pause
  exit /b 1
)

echo [visit-manager] a arrancar em modo local...
echo [visit-manager] url: http://127.0.0.1:5050
echo [visit-manager] login: http://127.0.0.1:5050/api/login
echo.

call npm run dev:local

pause
