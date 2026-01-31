@echo off
echo ========================================
echo S4 Photonic Simulation GUI
echo ========================================
echo.

REM Check if conda is available
where conda >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Conda is not installed or not in PATH
    echo Please install Anaconda/Miniconda first
    pause
    exit /b 1
)

REM Activate S4 environment
echo Activating S4 conda environment...
call conda activate S4
if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to activate S4 environment
    echo Make sure you have created the S4 environment with: conda create -n S4
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

REM Start backend server in background
echo Starting backend server on http://localhost:8000 ...
start "S4 Backend" cmd /c "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

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

REM Start frontend
echo Starting frontend on http://localhost:5173 ...
cd frontend
start "S4 Frontend" cmd /c "npm run dev"

REM Wait and open browser
timeout /t 5 /nobreak >nul
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
