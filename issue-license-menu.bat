@echo off
setlocal

set "ROOT_DIR=%~dp0"
set "SCRIPT_PATH=%ROOT_DIR%scripts\issue_license_menu.ps1"

if not exist "%SCRIPT_PATH%" (
    echo ERROR: No se encontro "%SCRIPT_PATH%"
    pause
    exit /b 1
)

cd /d "%ROOT_DIR%"
echo Abriendo menu de emision de licencias...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%"

if errorlevel 1 (
    echo.
    echo El menu termino con error.
    pause
    exit /b 1
)

endlocal
