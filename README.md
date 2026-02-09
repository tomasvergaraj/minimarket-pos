# MiniMarket POS

Sistema Punto de Venta para minimarkets en Chile. Multi-caja, offline-first, con inventario, caja, reportes Excel e impresión térmica.

## Arquitectura

```
┌─────────────────┐     LAN (HTTP)     ┌─────────────────┐
│   Caja 1        │◄──────────────────►│  PC Servidor    │
│   Electron App  │                    │  FastAPI        │
└─────────────────┘                    │  PostgreSQL     │
┌─────────────────┐                    │                 │
│   Caja 2        │◄──────────────────►│  Sync Worker    │
│   Electron App  │                    │  (Supabase)     │
└─────────────────┘                    └─────────────────┘
```

| Componente | Stack |
|---|---|
| Servidor | FastAPI + PostgreSQL + SQLAlchemy + Alembic |
| Cliente | Electron + React + Vite + TypeScript + Tailwind |
| Sync | Worker Python + Supabase (backup cloud opcional) |

## Prerequisitos

- **Windows 10/11**
- **PostgreSQL 15+** corriendo en el PC servidor
- **Python 3.11+**
- **Node.js 18+**

## Instalación

### 1. Base de datos

```sql
CREATE DATABASE minimarket_pos;
```

### 2. Servidor (PC principal)

```bat
setup-server.bat
```

O manualmente:

```bash
cd server-fastapi
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env        # editar DATABASE_URL si es necesario
python seed.py                # crea tablas + datos demo
python run.py                 # inicia en http://0.0.0.0:8000
```

### 3. Cliente (cada caja)

```bat
setup-client.bat
```

O manualmente:

```bash
cd client-electron-pos
npm install
npm run electron:dev          # desarrollo
npm run electron:build        # genera instalador .exe
```

### 4. Configurar IP del servidor en cada caja

Al iniciar la app, click en **"Configurar servidor"** e ingresar la IP LAN del PC servidor:

```
http://192.168.1.100:8000
```

## Uso

### Login

- **Admin:** PIN `1234`
- **Cajero 1:** PIN `0000`

### Atajos de teclado

| Tecla | Acción |
|---|---|
| F2 | Enfocar barra de búsqueda |
| F4 | Abrir cobro |
| ESC | Cerrar modales |

### Flujo de caja

1. Login con PIN
2. Seleccionar caja (Caja 1, 2, 3)
3. Abrir sesión con monto inicial
4. Vender (escanear barcode o buscar productos)
5. Cobrar (efectivo / tarjeta / mixto)
6. Cerrar caja → cuadre automático

### Lector de código de barras

El lector USB funciona como emulación de teclado. Al escanear un código, el sistema busca por barcode y agrega el producto al carrito automáticamente.

## API Endpoints

```
GET    /api/health
GET    /api/products/                  # listar productos
GET    /api/products/barcode/{code}    # buscar por barcode
POST   /api/products/                  # crear producto
PUT    /api/products/{id}              # actualizar producto

POST   /api/sales/                     # registrar venta
GET    /api/sales/{id}                 # ver venta
POST   /api/sales/{id}/void           # anular venta

GET    /api/cash/registers             # listar cajas
POST   /api/cash/sessions/open         # abrir sesión
POST   /api/cash/sessions/{id}/close   # cerrar sesión
GET    /api/cash/sessions/active       # sesiones activas

POST   /api/kardex/                    # movimiento inventario
GET    /api/kardex/product/{id}        # historial producto

GET    /api/reports/sales.xlsx?date_from=...&date_to=...
GET    /api/reports/inventory.xlsx

POST   /api/users/login/pin            # login por PIN
GET    /api/users/                     # listar usuarios

GET    /api/tax/sii/status             # estado SII (placeholder)
```

## Datos demo (seed)

El script `seed.py` crea:

- 2 usuarios (admin + cajero)
- 3 cajas registradoras
- 10 productos de ejemplo (bebidas, snacks, lácteos, limpieza, abarrotes)

## Generar instalador .exe

```bash
cd client-electron-pos
npm run electron:build
```

El instalador se genera en `client-electron-pos/dist-electron/`.

## Auto-update

Configurado con `electron-updater`. Publica releases en GitHub y la app se actualiza automáticamente. Editar `build.publish` en `package.json` con tu usuario/repo de GitHub.

## Instalar servidor como servicio Windows

Requiere [NSSM](https://nssm.cc/download) en el PATH:

```bash
cd server-fastapi
python install_service.py           # instalar
python install_service.py uninstall # desinstalar
```

## Sync cloud (Supabase)

Configurar en `.env`:

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
```

Iniciar worker:

```bash
cd sync-worker
pip install -r requirements.txt
python sync.py
```

Sincroniza cada 30 minutos cuando hay internet.

## Estructura del proyecto

```
minimarket-pos/
├── server-fastapi/
│   ├── app/
│   │   ├── api/routes/        # endpoints REST
│   │   ├── core/              # configuración
│   │   ├── db/                # engine + session
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # lógica de negocio
│   │   └── tax/sii/           # placeholder SII
│   ├── alembic/               # migraciones DB
│   ├── seed.py                # datos iniciales
│   ├── run.py                 # iniciar servidor
│   └── install_service.py     # servicio Windows
├── client-electron-pos/
│   ├── electron/              # main + preload
│   ├── src/
│   │   ├── pages/             # Login, POS, Settings
│   │   ├── components/        # PaymentModal, ReceiptView
│   │   ├── stores/            # Zustand (auth, cart)
│   │   ├── services/          # API client, printer
│   │   └── types/             # TypeScript interfaces
│   └── package.json           # electron-builder config
├── sync-worker/               # sync Supabase
├── setup-server.bat
├── setup-client.bat
└── start-server.bat
```

## Notas técnicas

- **Multi-caja seguro:** Locks con `SELECT ... FOR UPDATE` en PostgreSQL para stock y sesiones de caja
- **IVA Chile 19%:** Incluido en precio de venta, extraído con `tax = subtotal × 19 / 119`
- **UUIDs:** Todas las PKs son UUID strings para evitar colisiones entre cajas
- **Impresión térmica:** ESC/POS 80mm vía `electron-pos-printer` (IPC desde renderer)

## Pendiente / Roadmap

- [ ] Boleta electrónica SII (requiere certificado digital + CAF)
- [ ] WhatsApp Business Cloud API para reportes diarios
- [ ] Alembic migrations auto-generadas
- [ ] Supabase schema mirroring completo
