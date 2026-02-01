@echo off
echo Stopping S4 Simulation GUI...
echo.

set "PROJECT_DIR=%~dp0"
set "PID_FILE=%PROJECT_DIR%\.pids"

REM First try to kill by window title (most reliable for our spawned processes)
echo Closing S4 Backend window...
taskkill /FI "WINDOWTITLE eq S4 Backend*" /F >nul 2>nul

echo Closing S4 Frontend window...
taskkill /FI "WINDOWTITLE eq S4 Frontend*" /F >nul 2>nul

REM Also kill any uvicorn process listening on port 8000 (our port)
echo Checking for processes on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    echo Killing process %%a on port 8000
    taskkill /PID %%a /F >nul 2>nul
)

REM Also kill any process listening on port 5173 (Vite dev server)
echo Checking for processes on port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do (
    echo Killing process %%a on port 5173
    taskkill /PID %%a /F >nul 2>nul
)

REM Clean up PID file
if exist "%PID_FILE%" del "%PID_FILE%"

echo.
echo Done. S4 Simulation GUI has been stopped.
echo.
