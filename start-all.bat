@echo off
echo Iniciando Nexo...

REM Start server
start "Nexo Server" cmd /c "cd /d %~dp0server-fastapi && call venv\Scripts\activate.bat && python run.py"

REM Start sync worker
start "Nexo Sync" cmd /c "cd /d %~dp0server-fastapi && call venv\Scripts\activate.bat && python ..\sync-worker\sync.py"

REM Start admin web
start "Nexo Admin Web" cmd /c "cd /d %~dp0admin-web && npm run dev -- --host 0.0.0.0 --port 5174"

echo Servidor, Sync Worker y Admin Web iniciados.
