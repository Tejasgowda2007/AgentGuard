Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Running AgentGuard Automated Security Test Suite" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

& "$scriptDir\venv\Scripts\pytest.exe" -v backend\tests

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] All 18 automated security tests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[FAILURE] Some tests failed. Please review the output above." -ForegroundColor Red
}
