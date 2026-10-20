$ErrorActionPreference = "Stop"
$root = "C:\Users\gowda\.gemini\antigravity\scratch\agentguard"
Set-Location $root

Write-Host ">>> Python venv" -ForegroundColor Cyan
$py = if (Test-Path "$root\venv\Scripts\python.exe") { "$root\venv\Scripts\python.exe" }
      elseif (Test-Path "$root\.venv\Scripts\python.exe") { "$root\.venv\Scripts\python.exe" }
      else { throw "No venv found" }
Write-Host "    using $py"

Write-Host ">>> Installing backend deps (first run: 1-3 min)" -ForegroundColor Cyan
if (Test-Path "$root\backend\requirements.txt") {
    & $py -m pip install -q -r "$root\backend\requirements.txt"
} else {
    & $py -m pip install -q fastapi "uvicorn[standard]" sqlalchemy pydantic pyyaml pytest httpx scikit-learn python-multipart
}

Write-Host ">>> Env files" -ForegroundColor Cyan
if (-not (Test-Path "$root\backend\.env")) {
    if (Test-Path "$root\.env")         { Copy-Item "$root\.env" "$root\backend\.env" }
    elseif (Test-Path "$root\.env.example") { Copy-Item "$root\.env.example" "$root\backend\.env" }
}
"VITE_API_URL=http://127.0.0.1:8000" | Set-Content "$root\frontend\.env" -Encoding ascii

Write-Host ">>> npm install (first run: 1-3 min)" -ForegroundColor Cyan
Push-Location "$root\frontend"; npm install; Pop-Location

Write-Host ">>> Backend :8000" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location '$root\backend'; & '$py' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 5

Write-Host ">>> Frontend :5173" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location '$root\frontend'; npm run dev"

Start-Sleep -Seconds 8
Start-Process "http://localhost:5173"

Write-Host "`nDashboard: http://localhost:5173   API docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow