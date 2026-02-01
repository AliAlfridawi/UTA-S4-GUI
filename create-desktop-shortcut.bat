@echo off
echo Creating S4 Simulation GUI desktop shortcut...
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"
