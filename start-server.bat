@echo off
cd /d "%~dp0server-fastapi"
call venv\Scripts\activate.bat
python run.py
