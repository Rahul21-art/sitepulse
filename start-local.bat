@echo off
setlocal
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)
if not exist .env copy .env.example .env >nul
echo.
echo SitePulse starting at http://localhost:8080
echo Press Ctrl+C to stop.
echo.
npm start
