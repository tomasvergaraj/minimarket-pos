@echo off
set "SERVER_DIR=%~dp0"

cd /d "%SERVER_DIR%"

if not exist "%SERVER_DIR%venv\Scripts\python.exe" (
  echo Nexo backend venv not found at "%SERVER_DIR%venv\Scripts\python.exe"
  exit /b 1
)

"%SERVER_DIR%venv\Scripts\python.exe" "%SERVER_DIR%serve.py"
