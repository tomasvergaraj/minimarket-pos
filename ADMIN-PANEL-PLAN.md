# Plan: Panel Admin Web - MiniMarket POS (Dividido por Agente)

## Contexto
El sistema POS actual solo tiene interfaz para cajeros (Electron). Se necesita un panel de administración web accesible desde cualquier navegador en la LAN para gestionar productos, usuarios, ventas, inventario, reportes y configuración.

## Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Frontend data layer: @tanstack/react-query, react-router-dom v6, axios, lucide-react, react-hot-toast
- Backend: FastAPI (`server-fastapi/app/`)
- Proyecto nuevo frontend: `admin-web/` en la raíz

---

## División de Trabajo

### Claude Code -> Frontend (admin-web)
Responsable de toda la implementación UI/UX, rutas, componentes, estado cliente e integración con endpoints.

#### Fase FE-1: Scaffold y base del proyecto
- Crear `admin-web/` con Vite React-TS.
- Configurar Tailwind, React Query, Router, axios y estructura base:
  - `src/main.tsx`, `src/App.tsx`, `src/index.css`
  - `src/services/api.ts`
  - `src/types/index.ts`
  - `src/context/AuthContext.tsx`
  - `src/components/layout/` (AdminLayout, Sidebar, TopBar)
  - `src/components/shared/` (DataTable, Modal, ConfirmDialog, SearchInput, DateRangePicker, StatCard, Badge)
  - `src/components/products/`, `users/`, `sales/`, `inventory/`, `cash/`, `reports/`
  - `src/pages/` (LoginPage, DashboardPage, ProductsPage, UsersPage, SalesPage, InventoryPage, ReportsPage, CashPage, ConfigPage)
- Configurar Vite dev server en puerto `5174`.

#### Fase FE-2: Autenticación y layout
- Implementar Login por PIN.
- Bloquear acceso si `role != admin`.
- Implementar `AdminLayout + Sidebar + TopBar` con 8 secciones.

#### Fase FE-3: Páginas funcionales
- `DashboardPage`:
  - 6 KPI cards
  - Top 5 productos
  - Auto-refresh cada 60s
- `ProductsPage`:
  - Tabla con búsqueda/filtro categoría
  - Modal crear/editar
  - Desactivar con confirmación
- `UsersPage`:
  - Tabla de usuarios
  - Modal crear/editar (username, nombre, PIN, rol, activo)
- `SalesPage`:
  - Filtros (fechas, caja, estado)
  - Tabla + badge estado
  - Modal detalle items
  - Botón anular venta
- `InventoryPage`:
  - Tabla stock actual
  - Resaltado bajo mínimo
  - Modal kardex por producto
  - Modal movimiento (restock/ajuste/merma)
- `ReportsPage`:
  - Descarga de reportes Excel de ventas e inventario
- `CashPage`:
  - Lista/alta de cajas registradoras
  - Historial de sesiones con filtros
  - Detalle de sesión
- `ConfigPage`:
  - Formulario nombre tienda, RUT, dirección

#### Fase FE-4: Integración y scripts
- Integrar todas las llamadas HTTP contra endpoints backend definidos por Codex.
- Crear/ajustar script de arranque frontend en `start-admin.bat`.

---

### Codex -> Backend (FastAPI)
Responsable de modelado de endpoints, validación, reglas de negocio, consultas, seguridad básica y contratos para frontend.

#### Fase BE-1: Endpoints nuevos/actualizados
Archivos en `server-fastapi/app/`:

1. `api/routes/sales.py` -> agregar `GET /api/sales/`
- Query params: `date_from`, `date_to`, `register_id`, `status`, `skip`, `limit`
- Retornar lista de ventas filtradas

2. `api/routes/cash.py` -> agregar `GET /api/cash/sessions`
- Query params: `register_id`, `status`, `date_from`, `date_to`, `skip`, `limit`
- Retornar historial completo de sesiones

3. `api/routes/users.py` -> agregar `PUT /api/users/{user_id}`
- Schema `UserUpdate` con campos opcionales: `username`, `pin`, `full_name`, `role`, `is_active`

4. Nuevo `api/routes/dashboard.py` -> `GET /api/dashboard/stats`
- Retornar: `ventas_hoy`, `ingresos_hoy`, `ticket_promedio`, `cajas_abiertas`, `productos_bajo_stock`, `ventas_anuladas`, `top_5_productos`
- Registrar router en `main.py`

5. `main.py` -> agregar `PUT /api/config`
- Actualizar `STORE_NAME`, `STORE_RUT`, `STORE_ADDRESS`

#### Fase BE-2: Contratos y consistencia para frontend
- Estandarizar respuestas y errores para consumo en `admin-web`.
- Validar permisos para operaciones administrativas.
- Asegurar paginación/filtros consistentes en listados.

#### Fase BE-3: Integración operativa
- Ajustar `start-all.bat` para incluir backend + frontend admin.
- Verificar CORS/config necesaria para `http://localhost:5174`.

---

## Dependencias entre agentes
1. Codex publica contratos finales de endpoints (request/response) antes de cerrar FE-3.
2. Claude Code implementa UI con mocks temporales si un endpoint aún no está listo.
3. Integración final se valida con backend real y ajustes de contrato mínimos.

---

## Verificación conjunta
1. `cd admin-web && npm run dev` -> abre en `http://localhost:5174`
2. Login con PIN admin (`1234`) -> acceso permitido
3. Login con PIN cajero (`0000`) -> acceso denegado
4. Crear/editar/desactivar producto desde admin -> reflejado en POS
5. Ver ventas generadas en POS desde `SalesPage`
6. Descargar Excel en `ReportsPage`
7. Registrar movimiento de inventario -> stock actualizado
