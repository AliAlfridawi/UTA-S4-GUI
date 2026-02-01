@echo off
REM Backend startup helper script
REM This script is called by start.bat to launch the backend with proper conda activation

REM Get parameters
set "CONDA_PATH=%~1"
set "PROJECT_DIR=%~2"

REM Initialize conda
call "%CONDA_PATH%\Scripts\activate.bat" "%CONDA_PATH%"

REM Activate S4 environment
call conda activate S4

REM Change to backend directory
cd /d "%PROJECT_DIR%backend"

REM Start uvicorn server
python -m uvicorn main:app --host 0.0.0.0 --port 8000
