# MiniMarket POS

Sistema Punto de Venta para minimarkets en Chile. Incluye backend FastAPI, app Electron para cajas, panel admin web y worker de sincronizacion opcional.

## Arquitectura

```text
Caja 1 (Electron) ----\
Caja 2 (Electron) ----- LAN / HTTP ---- PC servidor
Caja N (Electron) ----/                 - FastAPI
                                         - PostgreSQL
                                         - Admin web en /admin
                                         - Sync worker opcional
```

| Componente | Stack |
|---|---|
| Servidor | FastAPI + PostgreSQL + SQLAlchemy + Alembic |
| Panel admin | React + Vite + TypeScript + Tailwind |
| Cliente POS | Electron + React |
| Sync | Worker Python + Supabase |

## Prerequisitos

- Windows 10/11
- PostgreSQL 15+
- Python 3.11+
- Node.js 20+

## Instalacion del servidor en Windows

### Opcion recomendada

Usa el instalador PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-server.ps1 `
  -StoreName "Almacen Don Pedro" `
  -StoreRut "76.123.456-7" `
  -StoreAddress "Av. Principal 123, Santiago" `
  -AdminPin "2580" `
  -CashierPin "1590" `
  -RegisterCount 2 `
  -DatabaseName "minimarket_pos" `
  -DatabaseUser "minimarket_pos" `
  -DatabasePassword "Cambia-Esta-Clave-2026"
```

Ese script:

- eleva permisos a administrador
- instala Python, Node.js y PostgreSQL si faltan
- crea la base de datos y el usuario de la app
- crea `server-fastapi/.env`
- crea `server-fastapi/venv` e instala dependencias
- compila `admin-web`
- inicializa schema y datos base
- abre en firewall el puerto configurado
- instala el servicio Windows `MiniMarketPOS-Server`

Notas:

- Si PostgreSQL ya existe, pasa `-PostgresSuperPassword`.
- Si el puerto `8000` esta ocupado, usa `-ServerPort 8001` u otro libre.
- El panel admin no corre como servicio aparte: lo sirve el backend en `/admin`.

### Instalacion manual

1. Crea base de datos y usuario en PostgreSQL.

```sql
CREATE USER minimarket_pos WITH PASSWORD 'Cambia-Esta-Clave-2026';
CREATE DATABASE minimarket_pos OWNER minimarket_pos;
```

2. Prepara el backend.

```powershell
cd server-fastapi
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
venv\Scripts\python.exe bootstrap.py `
  --database-url "postgresql://minimarket_pos:Cambia-Esta-Clave-2026@localhost:5432/minimarket_pos" `
  --server-port 8000 `
  --store-name "Nexo" `
  --admin-pin "1234" `
  --cashier-pin "0000" `
  --register-count 3 `
  --overwrite-env
```

3. Compila el panel admin.

```powershell
cd ..\admin-web
npm install
npm run build
```

4. Instala el servicio Windows.

```powershell
cd ..\server-fastapi
venv\Scripts\python.exe install_service.py install
```

## Actualizacion del servidor existente

Para una instalacion ya operativa, no reutilices `install-server.ps1` como flujo de upgrade porque hoy reescribe `server-fastapi/.env`.

Usa el script de actualizacion:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\update-server.ps1 `
  -InstallRoot "C:\Ruta\InstalacionActual"
```

Ese script:

- respalda `server-fastapi/.env` y el codigo actual en `server-fastapi\backups\update-AAAAMMDD-HHMMSS`
- conserva la `.env` existente
- instala dependencias Python segun `requirements.txt`
- ejecuta la actualizacion de schema y migraciones
- reinstala y levanta el servicio Windows `MiniMarketPOS-Server`

Si la actualizacion es offline y no cambian dependencias, puedes agregar `-SkipPipInstall`.

## Operacion del servicio Windows

El backend usa un servicio Windows nativo llamado `MiniMarketPOS-Server`.

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py status
venv\Scripts\python.exe install_service.py start
venv\Scripts\python.exe install_service.py stop
venv\Scripts\python.exe install_service.py restart
venv\Scripts\python.exe install_service.py uninstall
```

Puntos importantes:

- Ejecuta `install`, `start`, `stop`, `restart` y `uninstall` desde una terminal con privilegios de administrador.
- El servicio elimina la tarea programada legacy si todavia existe.
- El panel admin queda disponible en `http://localhost:<puerto>/admin`.
- El log del host queda en `server-fastapi/logs/windows-service-host.log`.

## Instalacion del cliente POS

En cada caja puedes usar el instalador compilado o construirlo manualmente.

```powershell
cd client-electron-pos
npm install
npm run electron:build
```

El instalador queda en `client-electron-pos/dist-electron/`.

## Limpieza de artefactos locales

Para limpiar artefactos de build del repo sin tocar la base de datos ni `server-fastapi/.env`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\clean-build-artifacts.ps1
```

Opciones utiles:

- `-IncludeLogs` para borrar logs del backend
- `-IncludeNodeModules` para borrar `node_modules`
- `-IncludeVenv` para borrar `server-fastapi\venv`
- `-WhatIf` para simular la limpieza

Al iniciar la app:

1. Pulsa `Configurar servidor`.
2. Ingresa `http://IP_DEL_SERVIDOR:<puerto>`.
3. Inicia sesion con PIN.
4. Selecciona la caja.

## URLs utiles

- Health: `http://localhost:<puerto>/api/health`
- Admin: `http://localhost:<puerto>/admin`
- Admin desde LAN: `http://IP_DEL_SERVIDOR:<puerto>/admin`

Si no cambias `-ServerPort`, el puerto por defecto es `8000`.

## Credenciales iniciales

- Admin: PIN definido en la instalacion
- Cajero base: PIN definido en la instalacion
- Usuario interno admin: `admin`
- Usuario interno cajero base: `cajero1`

## API principal

```text
GET    /api/health
GET    /api/products/
POST   /api/products/
PUT    /api/products/{id}

POST   /api/sales/
GET    /api/sales/{id}
POST   /api/sales/{id}/void

GET    /api/cash/registers
GET    /api/cash/sessions
POST   /api/cash/sessions/open
POST   /api/cash/sessions/{id}/close

POST   /api/kardex/
GET    /api/kardex/product/{id}

GET    /api/reports/sales.xlsx
GET    /api/reports/inventory.xlsx

POST   /api/users/login/pin
GET    /api/users/
```

## Sync cloud opcional

Configura en `server-fastapi/.env`:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
```

Luego ejecuta:

```powershell
cd sync-worker
pip install -r requirements.txt
python sync.py
```

## Estructura del proyecto

```text
minimarket-pos/
  server-fastapi/
    app/
    alembic/
    install_service.py
    NexoBackendServiceHost.cs
    seed.py
  admin-web/
  client-electron-pos/
  sync-worker/
  scripts/windows/install-server.ps1
  setup-server.bat
  setup-client.bat
```

## Notas tecnicas

- Multi-caja seguro con locks en PostgreSQL.
- IVA Chile 19% incluido en precio de venta.
- Todas las PKs usan UUID.
- El admin web compilado se sirve desde el backend.
- El login de admin y POS es por PIN.
