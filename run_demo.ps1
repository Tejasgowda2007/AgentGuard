Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Launching AgentGuard AI Runtime Security Platform" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "1. Backend:  http://127.0.0.1:8000 (Swagger: http://127.0.0.1:8000/docs)"
Write-Host "2. Frontend: http://localhost:5173"
Write-Host "========================================================"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start Backend in new process
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\backend'; & '$scriptDir\venv\Scripts\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 3

# Start Frontend in new process
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$scriptDir\frontend'; npm run dev"

Start-Sleep -Seconds 2

# Open browser
Start-Process "http://localhost:5173"

Write-Host "`nAgentGuard is now running. Press Ctrl+C in the respective windows to stop." -ForegroundColor Green
