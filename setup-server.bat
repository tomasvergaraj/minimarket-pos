@echo off
echo ============================================
echo  Nexo - Server Setup
echo ============================================
echo.

REM Check Python
python --version 2>nul
if errorlevel 1 (
    echo ERROR: Python no encontrado. Instale Python 3.11+
    pause
    exit /b 1
)

echo [1/4] Creando entorno virtual...
cd /d "%~dp0server-fastapi"
python -m venv venv
call venv\Scripts\activate.bat

echo [2/4] Instalando dependencias...
pip install -r requirements.txt

echo [3/4] Configurando base de datos...
echo Asegurese de tener PostgreSQL instalado y corriendo.
echo Cree la base de datos: CREATE DATABASE minimarket_pos;
echo.

copy .env.example .env 2>nul

echo [4/4] Creando tablas y datos iniciales...
python seed.py

echo.
echo ============================================
echo  Setup completado!
echo  Para iniciar el servidor:
echo    cd server-fastapi
echo    venv\Scripts\activate
echo    python run.py
echo.
echo  Para dejarlo como servicio de Windows:
echo    cd server-fastapi
echo    python install_service.py install
echo.
echo  El panel admin quedara disponible en:
echo    http://localhost:8000/admin
echo ============================================
pause
