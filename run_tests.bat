@echo off
echo ========================================================
echo Running AgentGuard Automated Security Test Suite
echo ========================================================
cd /d "%~dp0"
call venv\Scripts\pytest.exe -v backend\tests
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] All automated security tests passed!
) else (
    echo.
    echo [FAILURE] Test suite encountered errors.
)
pause
