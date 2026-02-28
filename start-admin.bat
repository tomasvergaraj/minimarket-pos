@echo off
echo Iniciando MiniMarket Admin Web...
cd /d "%~dp0admin-web"
npm run dev -- --host 0.0.0.0 --port 5174
