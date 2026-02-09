@echo off
echo ============================================
echo  MiniMarket POS - Client Setup
echo ============================================
echo.

REM Check Node.js
node --version 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no encontrado. Instale Node.js 18+
    pause
    exit /b 1
)

cd /d "%~dp0client-electron-pos"

echo [1/2] Instalando dependencias...
npm install

echo [2/2] Listo!
echo.
echo ============================================
echo  Para desarrollo:
echo    cd client-electron-pos
echo    npm run electron:dev
echo.
echo  Para compilar instalador .exe:
echo    npm run electron:build
echo ============================================
pause
