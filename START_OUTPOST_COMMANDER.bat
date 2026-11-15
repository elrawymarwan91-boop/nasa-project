@echo off
setlocal
cd /d "%~dp0"

echo ==============================================
echo          OUTPOST COMMANDER - STARTUP
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js was not found.
  echo Install Node.js 22.14 or newer, then run this file again.
  pause
  exit /b 1
)

for /f "tokens=1" %%v in ('node -p "process.versions.node"') do set NODE_VERSION=%%v
for /f "tokens=1,2 delims=." %%a in ("%NODE_VERSION%") do (
  set NODE_MAJOR=%%a
  set NODE_MINOR=%%b
)
if %NODE_MAJOR% LSS 22 (
  echo ERROR: Node.js 22.14 or newer is required. Current version: %NODE_VERSION%
  pause
  exit /b 1
)
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% LSS 14 (
  echo ERROR: Node.js 22.14 or newer is required. Current version: %NODE_VERSION%
  pause
  exit /b 1
)

echo Node.js version: %NODE_VERSION%
if not exist node_modules\.bin\vite.cmd (
  echo.
  echo [1/4] Installing project dependencies...
  call npm ci
  if errorlevel 1 goto failed
) else (
  echo Dependencies folder found. Skipping npm ci.
)

if not exist .env (
  echo.
  echo [2/4] Creating local environment file...
  copy .env.example .env >nul
) else (
  echo [2/4] Local .env already exists.
)

echo.
echo [3/4] Generating Prisma client...
call npm run db:generate
if errorlevel 1 goto failed

echo.
echo [4/4] Preparing local database...
call npm run db
if errorlevel 1 goto failed

echo.
echo Starting the game. Keep this window open.
echo Open http://localhost:5173 in your browser.
echo Press Ctrl+C here to stop the game.
echo.
call npm run dev
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Startup failed. Read the error above and check README.md for troubleshooting.
pause
exit /b 1
