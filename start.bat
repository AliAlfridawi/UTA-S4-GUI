@echo off
echo ========================================
echo S4 Photonic Simulation GUI
echo ========================================
echo.

REM Store the project directory
set "PROJECT_DIR=%~dp0"
set "PID_FILE=%PROJECT_DIR%\.pids"

REM Clean up old PID file
if exist "%PID_FILE%" del "%PID_FILE%"

REM ========================================
REM Find Anaconda/Miniconda with S4 environment
REM ========================================
set "CONDA_PATH="

REM Check each installation for the S4 environment (first match wins)
if exist "%USERPROFILE%\miniconda3\envs\S4" (
    set "CONDA_PATH=%USERPROFILE%\miniconda3"
    goto :found_conda
)
if exist "%USERPROFILE%\anaconda3\envs\S4" (
    set "CONDA_PATH=%USERPROFILE%\anaconda3"
    goto :found_conda
)
if exist "%LOCALAPPDATA%\miniconda3\envs\S4" (
    set "CONDA_PATH=%LOCALAPPDATA%\miniconda3"
    goto :found_conda
)
if exist "%LOCALAPPDATA%\anaconda3\envs\S4" (
    set "CONDA_PATH=%LOCALAPPDATA%\anaconda3"
    goto :found_conda
)
if exist "C:\ProgramData\miniconda3\envs\S4" (
    set "CONDA_PATH=C:\ProgramData\miniconda3"
    goto :found_conda
)
if exist "C:\ProgramData\anaconda3\envs\S4" (
    set "CONDA_PATH=C:\ProgramData\anaconda3"
    goto :found_conda
)

REM S4 environment not found in any installation
echo ERROR: S4 conda environment not found in any Anaconda/Miniconda installation
echo.
echo Searched in:
echo   - %USERPROFILE%\miniconda3\envs\S4
echo   - %USERPROFILE%\anaconda3\envs\S4
echo   - %LOCALAPPDATA%\miniconda3\envs\S4
echo   - %LOCALAPPDATA%\anaconda3\envs\S4
echo   - C:\ProgramData\miniconda3\envs\S4
echo   - C:\ProgramData\anaconda3\envs\S4
echo.
echo Please create the S4 environment in Anaconda Prompt
pause
exit /b 1

:found_conda
echo Found conda at: %CONDA_PATH%
echo Found S4 environment at: %CONDA_PATH%\envs\S4

REM Initialize conda for this session
echo Initializing conda...
call "%CONDA_PATH%\Scripts\activate.bat" "%CONDA_PATH%"

REM Activate S4 environment
echo Activating S4 conda environment...
call conda activate S4
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to activate S4 environment
    pause
    exit /b 1
)

REM Check if backend dependencies are installed
echo Checking backend dependencies...
pip show fastapi >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Installing backend dependencies...
    pip install -r backend\requirements.txt
)

REM Start backend server in background (using helper script to avoid quoting issues)
echo Starting backend server on http://localhost:8000 ...
start "S4 Backend" /MIN cmd /c ""%PROJECT_DIR%start-backend.bat" "%CONDA_PATH%" "%PROJECT_DIR%""

REM Wait a moment for backend to start and get PID
timeout /t 2 /nobreak >nul
for /f "tokens=2" %%a in ('tasklist /fi "WINDOWTITLE eq S4 Backend*" /fo list ^| find "PID:"') do (
    echo BACKEND_PID=%%a >> "%PID_FILE%"
)

REM Wait additional time for backend initialization
timeout /t 1 /nobreak >nul

REM Check if Node.js is available
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo WARNING: Node.js/npm is not installed
    echo The backend is running, but you need Node.js to run the frontend
    echo Download from: https://nodejs.org/
    echo.
    echo Backend API available at: http://localhost:8000
    echo API docs available at: http://localhost:8000/docs
    pause
    exit /b 0
)

REM Check if frontend dependencies are installed
if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

REM Start frontend and capture PID
echo Starting frontend on http://localhost:5173 ...
cd frontend
start "S4 Frontend" /MIN cmd /c "npm run dev"
cd ..

REM Wait a moment and get frontend PID
timeout /t 2 /nobreak >nul
for /f "tokens=2" %%a in ('tasklist /fi "WINDOWTITLE eq S4 Frontend*" /fo list ^| find "PID:"') do (
    echo FRONTEND_PID=%%a >> "%PID_FILE%"
)

REM Wait for frontend to be ready
timeout /t 3 /nobreak >nul
echo.
echo ========================================
echo S4 Simulation GUI is running!
echo ========================================
echo.
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Press any key to open the browser...
pause >nul

start http://localhost:5173
