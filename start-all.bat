@echo off
echo Iniciando MiniMarket POS...

REM Start server
start "MiniMarket Server" cmd /c "cd /d %~dp0server-fastapi && call venv\Scripts\activate.bat && python run.py"

REM Start sync worker
start "MiniMarket Sync" cmd /c "cd /d %~dp0server-fastapi && call venv\Scripts\activate.bat && python ..\sync-worker\sync.py"

echo Servidor y Sync Worker iniciados.
