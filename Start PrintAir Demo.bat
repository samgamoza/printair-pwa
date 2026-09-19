@echo off
rem Double-click to open the PrintAir app on this computer with sample data.
rem Nothing is sent anywhere: the "backend" is pretend and runs inside the browser tab.
title PrintAir demo
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed. Get the LTS version from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo  First run: installing what the app needs. This takes a few minutes, once.
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  The install did not finish. Check your internet connection and run this again.
    pause
    exit /b 1
  )
)

echo.
echo  Starting PrintAir at http://localhost:4180  ^(your browser will open by itself^)
echo  Use the yellow "Demo" button to switch between customer, partner, designer and admin.
echo  Close this window to stop.
echo.
call npm run demo
pause
