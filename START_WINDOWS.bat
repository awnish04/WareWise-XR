@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is required to run WareWise XR.
  echo Install Node.js 18 or newer, then run this file again.
  pause
  exit /b 1
)
echo Starting WareWise XR on http://127.0.0.1:8080
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8080"
node server.js
pause
