<div align="center">

# Nexo POS

**Sistema de Punto de Venta para minimarkets y negocios de retail en Chile**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![Windows](https://img.shields.io/badge/Windows-Service-0078D6?style=flat-square&logo=windows&logoColor=white)](https://learn.microsoft.com/en-us/dotnet/framework/windows-services/)

</div>

---

## Descripción

Nexo POS es un sistema completo de punto de venta orientado a minimarkets, almacenes y negocios de retail en Chile. Combina un backend robusto, un panel de administración web, un cliente POS de escritorio y una aplicación PWA para tablets y móviles — todo funcionando en red local sin dependencia de internet.

> **Prueba gratuita de 30 días** incluida en cada instalación. Activación mediante licencia firmada digitalmente vinculada al hardware del servidor.

---

## Componentes

```
                              ┌─────────────────────────────┐
                              │       PC SERVIDOR           │
                              │  ┌───────────────────────┐  │
  Tablet / Móvil  ────PWA───► │  │   FastAPI + Uvicorn   │  │
  Caja Electron   ────LAN───► │  │   PostgreSQL          │  │
  Admin Web       ────LAN───► │  │   Servicio Windows    │  │
                              │  └───────────────────────┘  │
                              │           /admin             │
                              │           /pos               │
                              └─────────────────────────────┘
                                          │
                              (opcional)  │  cloud sync
                                          ▼
                                   Supabase Cloud
```

| Componente | Descripción | Stack |
|---|---|---|
| `server-fastapi` | API REST + lógica de negocio | FastAPI · PostgreSQL · SQLAlchemy · Alembic |
| `admin-web` | Panel de administración web | React 19 · TypeScript · Tailwind CSS · Recharts |
| `mobile-web` | POS como PWA (tablet / móvil) | React 19 · TypeScript · Tailwind CSS v4 · Framer Motion |
| `client-electron-pos` | POS de escritorio (caja física) | Electron · React · TypeScript |
| `sync` (integrado) | Sincronización cloud con Supabase | Python · supabase-py |

---

## Funcionalidades

### Ventas y Caja

- Registro de ventas con métodos de pago: **efectivo, tarjeta, transferencia y mixto**
- Cambio automático y desglose por método de pago
- Sesiones de caja con apertura, cierre y conteo físico final
- Diferencia de caja (sobrante / faltante) al cerrar turno
- Ventas **offline** con cola local y sincronización automática al reconectarse
- Anulación de ventas con trazabilidad

### Inventario

- Gestión de productos con categorías, precio de costo y venta
- **Productos pack** — stock derivado del producto base (`pack ×N unidades`)
- Ajustes de stock con trazabilidad completa en kardex
- Historial de movimientos por producto con columnas antes / después
- Alertas automáticas de stock bajo

### Administración

- Panel web con **reportes descargables en Excel** (ventas, inventario)
- Dashboard con métricas del día: ventas, margen, productos más vendidos
- Gestión de usuarios con roles (admin / cajero) y autenticación por PIN
- Auditoría completa de acciones administrativas
- Gestión de proveedores y **órdenes de compra** *(módulo licenciable)*

### Fidelización

- Sistema de puntos por compra configurable (`$1.000 = N puntos`)
- Canje de puntos directamente en la venta
- Historial de compras y contador de visitas por cliente

### Módulos add-on (feature gating)

| Módulo | Feature flag | Descripción |
|---|---|---|
| Boleta electrónica | `sii` | Emisión de DTE con folio CAF — SII Chile |
| Sincronización cloud | `cloud_sync` | Backup y multi-sucursal con Supabase |
| Comandas | `orders` | Gestión de órdenes para locales con cocina |
| Órdenes de compra | `purchases` | Flujo completo: draft → confirmado → recibido |

### POS Móvil (PWA)

- Instalable en **Android e iOS** directamente desde el navegador
- Funciona **sin internet** (offline-first con service worker)
- Animaciones fluidas con Framer Motion v12
- Búsqueda de productos por nombre o código
- Favoritos, historial de ventas del turno y gestión de caja

### Licenciamiento

- Trial de **30 días** automático desde la primera instalación
- Licencias firmadas con **Ed25519** vinculadas al hardware del servidor
- Control de cajas activas (`max_registers`)
- **Feature gating**: activa módulos individuales por licencia
- Detección de manipulación del reloj del sistema

---

## Requisitos

| Componente | Mínimo |
|---|---|
| Sistema operativo | Windows 10 / 11 (64-bit) |
| CPU | x64, 2 núcleos |
| RAM | 2 GB (4 GB recomendado) |
| Almacenamiento | 2 GB libres |
| PostgreSQL | 15+ |
| Python | 3.11+ |
| Node.js | 20+ |
| Red local | WiFi o Ethernet para terminales |

---

## Instalación

### Opción A — Instalador automático (recomendado)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-server.ps1 `
  -StoreName    "Almacén Don Pedro" `
  -StoreRut     "76.123.456-7" `
  -StoreAddress "Av. Principal 123, Santiago" `
  -AdminPin     "2580" `
  -CashierPin   "1590" `
  -RegisterCount 2 `
  -DatabaseName "minimarket_pos" `
  -DatabaseUser "minimarket_pos" `
  -DatabasePassword "TuClaveSegura2026"
```

El script realiza automáticamente:

- Verificación y elevación de privilegios de administrador
- Instalación de Python, Node.js y PostgreSQL si no están presentes
- Creación de la base de datos y el usuario de la aplicación
- Generación del archivo `.env`
- Creación del entorno virtual e instalación de dependencias Python
- Compilación del panel admin y del POS móvil
- Inicialización del esquema y datos base (usuarios, cajas)
- Apertura del puerto en el firewall de Windows
- Instalación y arranque del **servicio Windows** `MiniMarketPOS-Server`

<details>
<summary><strong>Opciones adicionales del instalador</strong></summary>

| Parámetro | Descripción | Por defecto |
|---|---|---|
| `-ServerPort` | Puerto del servidor | `8001` |
| `-PostgresSuperPassword` | Contraseña del superusuario de PostgreSQL | — |
| `-SkipNodeInstall` | Omitir instalación de Node.js | `false` |
| `-SkipPostgresInstall` | Omitir instalación de PostgreSQL | `false` |

</details>

---

### Opción B — Instalación manual

<details>
<summary><strong>Ver pasos de instalación manual</strong></summary>

**1. Base de datos**

```sql
CREATE USER minimarket_pos WITH PASSWORD 'TuClaveSegura2026';
CREATE DATABASE minimarket_pos OWNER minimarket_pos;
```

**2. Backend**

```powershell
cd server-fastapi
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

venv\Scripts\python.exe bootstrap.py `
  --database-url "postgresql://minimarket_pos:TuClaveSegura2026@localhost:5432/minimarket_pos" `
  --server-port 8001 `
  --store-name "Nexo" `
  --admin-pin "1234" `
  --cashier-pin "0000" `
  --register-count 2 `
  --overwrite-env
```

**3. Panel admin**

```powershell
cd ..\admin-web
npm install
npm run build
```

**4. POS móvil (PWA)**

```powershell
cd ..\mobile-web
npm install
npm run build
```

**5. Servicio Windows**

```powershell
cd ..\server-fastapi
venv\Scripts\python.exe install_service.py install
venv\Scripts\python.exe install_service.py start
```

</details>

---

## Actualización

Para actualizar una instalación existente sin afectar datos ni configuración:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\update-server.ps1 `
  -InstallRoot "C:\Ruta\InstalacionActual"
```

El script respalda el `.env` y el código actual, ejecuta las migraciones Alembic y reinicia el servicio.

> Agrega `-SkipPipInstall` si la actualización no modifica dependencias de Python.

---

## Gestión del servicio Windows

> Ejecutar desde una terminal con **privilegios de administrador**.

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py status    # ver estado
venv\Scripts\python.exe install_service.py start     # iniciar
venv\Scripts\python.exe install_service.py stop      # detener
venv\Scripts\python.exe install_service.py restart   # reiniciar
venv\Scripts\python.exe install_service.py uninstall # desinstalar
```

Log del servicio: `server-fastapi/logs/windows-service-host.log`

---

## URLs

| Recurso | URL |
|---|---|
| Health check | `http://localhost:8001/api/health` |
| Panel admin | `http://localhost:8001/admin` |
| POS móvil (PWA) | `http://localhost:8001/pos` |
| Documentación API | `http://localhost:8001/docs` |
| Desde LAN | `http://<IP_SERVIDOR>:8001/...` |

---

## Credenciales iniciales

| Rol | Autenticación | Usuario interno |
|---|---|---|
| Administrador | PIN definido en instalación | `admin` |
| Cajero | PIN definido en instalación | `cajero1` |

---

## Referencia de API

<details>
<summary><strong>Ver endpoints principales</strong></summary>

```
# Sistema
GET    /api/health
GET    /api/config
PUT    /api/config

# Autenticación
POST   /api/users/login/pin
POST   /api/users/refresh
POST   /api/users/logout
GET    /api/users/

# Productos e inventario
GET    /api/products/
POST   /api/products/
PUT    /api/products/{id}
DELETE /api/products/{id}
GET    /api/categories/
POST   /api/kardex/
GET    /api/kardex/product/{id}

# Ventas
POST   /api/sales/
GET    /api/sales/
GET    /api/sales/{id}
POST   /api/sales/{id}/void

# Caja
GET    /api/cash/registers
POST   /api/cash/registers
GET    /api/cash/sessions/active
GET    /api/cash/sessions/{id}
POST   /api/cash/sessions/open
POST   /api/cash/sessions/{id}/close

# Clientes y fidelización
GET    /api/customers/
POST   /api/customers/
GET    /api/customers/{id}

# Reportes
GET    /api/reports/sales.xlsx
GET    /api/reports/inventory.xlsx
GET    /api/dashboard/

# Licencia
GET    /api/license/status
POST   /api/license/activate

# Módulos add-on (requieren feature en licencia)
GET    /api/orders/            # feature: orders
POST   /api/orders/
POST   /api/purchases/         # feature: purchases
GET    /api/sync/status        # feature: cloud_sync
POST   /api/sync/trigger
GET    /api/tax/sii/status     # feature: sii
POST   /api/tax/sii/caf/load
```

</details>

---

## Configuración del entorno

Variables relevantes en `server-fastapi/.env`:

```env
# Base de datos
DATABASE_URL=postgresql://minimarket_pos:clave@localhost:5432/minimarket_pos

# Servidor
SERVER_PORT=8001
SECRET_KEY=clave-secreta-larga-y-aleatoria

# Tienda
STORE_NAME=Mi Almacén
STORE_RUT=76.123.456-7
STORE_ADDRESS=Av. Principal 123, Santiago

# Fidelización
LOYALTY_POINTS_PER_THOUSAND=1   # puntos por cada $1.000 gastados
LOYALTY_POINT_VALUE=10          # CLP por punto al canjear

# Cloud sync (opcional)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
BRANCH_ID=sucursal-centro

# Email / recibos digitales (opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@email.com
SMTP_PASSWORD=app-password

# Licencia
LICENSE_PUBLIC_KEY_PATH=C:\nexo\license_public.pem
```

---

## Cliente POS Electron

Para compilar el instalador del cliente de escritorio:

```powershell
cd client-electron-pos
npm install
npm run electron:build
```

El instalador queda en `client-electron-pos/dist-electron/`.

**Configuración inicial del cliente:**

1. Pulsar **Configurar servidor**
2. Ingresar `http://<IP_SERVIDOR>:8001`
3. Iniciar sesión con PIN
4. Seleccionar la caja asignada

---

## Estructura del repositorio

```
nexo-pos/
├── server-fastapi/           # API REST + lógica de negocio
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/       # Endpoints FastAPI
│   │   │   └── deps.py       # Dependencias (auth, licencia, features)
│   │   ├── models/           # Modelos SQLAlchemy
│   │   ├── schemas/          # Schemas Pydantic
│   │   ├── services/         # Lógica de negocio
│   │   └── tax/sii/          # Integración boleta electrónica SII
│   ├── alembic/              # Migraciones de base de datos
│   ├── bootstrap.py          # Configuración inicial
│   └── install_service.py    # Gestión del servicio Windows
│
├── admin-web/                # Panel de administración (React SPA)
│   └── src/
│       ├── features/         # Módulos: inventario, ventas, reportes…
│       └── lib/              # Cliente HTTP y servicios
│
├── mobile-web/               # POS móvil offline-first (PWA)
│   └── src/
│       ├── pages/            # Pantallas del POS
│       ├── components/       # Componentes reutilizables
│       ├── hooks/            # Hooks: offline queue, sync sesión, favoritos
│       └── lib/              # API client, queue offline, servicios
│
├── client-electron-pos/      # Cliente POS de escritorio
│
└── scripts/windows/          # Scripts PowerShell
    ├── install-server.ps1    # Instalación completa
    └── update-server.ps1     # Actualización sin pérdida de datos
```

---

## Stack tecnológico

### Backend
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red?style=flat-square)](https://www.sqlalchemy.org)
[![Alembic](https://img.shields.io/badge/Alembic-1.14-orange?style=flat-square)](https://alembic.sqlalchemy.org)
[![Pydantic](https://img.shields.io/badge/Pydantic-2.10-E92063?style=flat-square&logo=pydantic&logoColor=white)](https://docs.pydantic.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)

### Frontend
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12-0055FF?style=flat-square&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?style=flat-square)](https://tanstack.com/query)

### Infraestructura
[![Windows Service](https://img.shields.io/badge/Windows_Service-nativo-0078D6?style=flat-square&logo=windows&logoColor=white)](https://learn.microsoft.com/en-us/dotnet/framework/windows-services/)
[![Electron](https://img.shields.io/badge/Electron-desktop-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org)
[![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Supabase](https://img.shields.io/badge/Supabase-cloud_sync-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)

---

## Licencia

Software comercial — todos los derechos reservados.  
El uso, copia o distribución sin licencia válida está prohibido.

Para adquirir una licencia contactar al desarrollador.
