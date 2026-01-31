@echo off
echo Stopping S4 Simulation GUI...

REM Kill backend (uvicorn)
taskkill /FI "WINDOWTITLE eq S4 Backend*" /F >nul 2>nul
taskkill /IM python.exe /F >nul 2>nul

REM Kill frontend (npm/node)
taskkill /FI "WINDOWTITLE eq S4 Frontend*" /F >nul 2>nul
taskkill /IM node.exe /F >nul 2>nul

echo Done.
