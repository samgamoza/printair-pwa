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

rem An earlier demo window may still be running and holding the address. Stop it so this one
rem always starts fresh with the latest version.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":4180 .*LISTENING"') do (
  echo  Closing the demo that was already running...
  taskkill /F /PID %%p >nul 2>nul
)

rem New fonts or tools may have been added since the last run.
if not exist "node_modules\@fontsource-variable\fraunces\" call npm install

echo.
echo  Starting PrintAir at http://localhost:4180  ^(your browser will open by itself^)
echo  Use the yellow "Demo" button to switch between customer, partner, designer and admin.
echo  Close this window to stop.
echo.
call npm run demo
pause
