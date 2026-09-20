@echo off
rem Double-click to send the latest saved work to GitHub (github.com/samgamoza/printair-pwa).
rem The first time, Windows opens a GitHub sign-in window. Sign in there; nothing is typed here.
title Push PrintAir PWA to GitHub
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Git is not installed. Get it from https://git-scm.com/download/win then run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo  Sending to GitHub...
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo  The push did not go through. Copy the message above and show it to Claude.
) else (
  echo.
  echo  Done. See it at https://github.com/samgamoza/printair-pwa
)
echo.
pause
