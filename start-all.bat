@echo off
echo Iniciando MiniMarket POS...

REM Start server
start "MiniMarket Server" cmd /c "cd /d %~dp0server-fastapi && call venv\Scripts\activate.bat && python run.py"

REM Start sync worker
start "MiniMarket Sync" cmd /c "cd /d %~dp0server-fastapi && call venv\Scripts\activate.bat && python ..\sync-worker\sync.py"

REM Start admin web
start "MiniMarket Admin Web" cmd /c "cd /d %~dp0admin-web && npm run dev -- --host 0.0.0.0 --port 5174"

echo Servidor, Sync Worker y Admin Web iniciados.
