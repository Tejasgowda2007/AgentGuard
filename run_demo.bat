@echo off
echo ========================================================
echo Launching AgentGuard AI Runtime Security Platform
echo ========================================================
echo 1. Starting Backend Gateway at http://127.0.0.1:8000
echo 2. Starting Frontend Console at http://localhost:5173
echo ========================================================

cd /d "%~dp0"
start "AgentGuard Backend" cmd /k "start_backend.bat"
timeout /t 3 /nobreak >nul
start "AgentGuard Frontend" cmd /k "start_frontend.bat"

echo Both services launched in separate terminal windows.
echo Opening browser to http://localhost:5173 ...
timeout /t 2 /nobreak >nul
start http://localhost:5173
