# Registro de Avances — MiniMarket POS

> Historial de implementaciones basado en el plan de mejoras (PLAN-MEJORAS.md)

---

## Estado general

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1.1 | Imágenes de productos | Completado |
| 1.2 | Grilla POS con categorías visuales | Completado |
| 1.3 | Pantalla cliente (Customer Display) | Completado |
| 1.4 | Atajos de teclado en POS | Completado |
| 1.5 | Resumen visual de turno | Completado |
| 2.1 | Gestión de Proveedores y OC | Completado |
| 2.2 | Motor de Promociones | Completado |
| 2.3 | Fidelización de Clientes | Completado |
| 2.4 | Recibos Digitales | Completado |
| 2.5 | Dashboard con Gráficos | Completado |
| 2.6 | Alertas y Notificaciones | Completado |
| 3.1 | Boleta Electrónica SII | Pendiente |
| 3.2 | Módulo de Gastos | Completado |
| 3.3 | Mesas/Comandas mejorado | Completado |
| 3.4 | App Móvil / PWA Admin | Completado |
| 3.5 | Sync Cloud / Multi-sucursal | Completado |
| 3.6 | Integración Transbank | Completado |

---

## Detalles por ítem

### Fase 1.1 — Imágenes de productos
- **Estado:** Completado
- **Fecha:** 2026-03-23
- **Archivos modificados:**
  - `server-fastapi/alembic/versions/0009_add_product_image_url.py` (nueva migración)
  - `server-fastapi/app/models/product.py` (campo `image_url`)
  - `server-fastapi/app/schemas/product.py` (campo en todos los schemas)
  - `server-fastapi/app/api/routes/products.py` (endpoints `POST /{id}/image` y `DELETE /{id}/image`)
  - `server-fastapi/app/main.py` (mount `StaticFiles` en `/static`)
  - `admin-web/src/types/index.ts` (campo `image_url` en Product, ProductCreate, ProductUpdate)
  - `admin-web/src/lib/services.ts` (funciones `uploadProductImage`, `deleteProductImage`)
  - `admin-web/src/features/products/ProductsPage.tsx` (columna thumbnail + upload en handleSave)
  - `admin-web/src/features/products/ProductFormModal.tsx` (sección imagen con preview y upload)
  - `client-electron-pos/src/types/index.ts` (campo `image_url` en Product y FavoriteSlot)
  - `client-electron-pos/src/components/FavoritesPanel.tsx` (imagen de fondo semitransparente en slots)
- **Notas:** Las imágenes se guardan en `server-fastapi/static/images/product_{id}.{ext}`. Se sirven en `/static/images/`. Aplicar migración con `alembic upgrade head`.

---

### Fase 1.2 — Grilla POS con categorías visuales
- **Estado:** Completado
- **Fecha:** 2026-03-23
- **Archivos modificados:**
  - `client-electron-pos/src/components/CategoryGrid.tsx` (nuevo componente)
  - `client-electron-pos/src/pages/POSPage.tsx` (integración del componente)
  - `client-electron-pos/src/components/FavoritesPanel.tsx` (fix: `image_url` en fallback)
  - `client-electron-pos/src/components/OrdersModal.tsx` (fix: `image_url` en fallback)
- **Notas:** Pills de categorías con color configurable. Al seleccionar categoría se muestra grilla de productos con imagen, precio y badge de oferta. Se apila sobre el panel de Favoritos existente.

---

### Fase 1.3 — Pantalla cliente (Customer Display)
- **Estado:** Completado
- **Fecha:** 2026-03-23
- **Archivos modificados:**
  - `client-electron-pos/electron/main.js` (segunda BrowserWindow, auto-posición en monitor externo, IPC handlers)
  - `client-electron-pos/electron/preload.js` (bridge IPC: update/open/close/isOpen/onState)
  - `client-electron-pos/src/vite-env.d.ts` (tipos `CustomerDisplayState`, `ElectronAPI` extendido)
  - `client-electron-pos/src/pages/CustomerDisplayPage.tsx` (nueva página: idle/selling/paid)
  - `client-electron-pos/src/App.tsx` (ruta `/customer-display` sin auth)
  - `client-electron-pos/src/pages/POSPage.tsx` (sync de carrito, estado paid al completar venta, botón Monitor en header)
- **Notas:** Se auto-abre al iniciar el POS. Si hay monitor secundario se posiciona fullscreen en él. El botón Monitor en header permite abrir/cerrar manualmente. Estado "paid" se auto-resetea a "idle" en 4 segundos.

---

### Fase 1.4 — Atajos de teclado en POS
- **Estado:** Completado
- **Fecha:** 2026-03-23
- **Archivos modificados:**
  - `client-electron-pos/src/pages/POSPage.tsx` (handler global `keydown`, atajos F1-F4, Escape, +/-, Delete, hint bar)
- **Notas:** F1/F2 enfocan búsqueda, F3 limpia carrito, F4 abre pago, Escape cierra búsqueda, +/- incrementan/decrementan último ítem, Delete elimina último ítem. Barra de hints en la parte inferior del panel izquierdo.

---

### Fase 1.5 — Resumen visual de turno
- **Estado:** Completado
- **Fecha:** 2026-03-23
- **Archivos modificados:**
  - `client-electron-pos/src/components/CloseSessionModal.tsx` (vista de resultado completamente rediseñada)
- **Notas:** La vista de cierre ahora muestra: grilla 2×2 con total ventas, N° transacciones, ticket promedio y apertura de caja; barras de desglose proporcionales por método de pago (verde=efectivo, azul=tarjeta, morado=transferencia) con porcentaje; sección de reconciliación de caja (esperado vs declarado); tarjeta de diferencia prominente con icono contextual (✓ sin diferencia / ↑ sobrante / ⚠ faltante); botón "Imprimir" que genera resumen para impresora térmica (visible solo si Electron API disponible).

---

---

### Fase 2.1 — Gestión de Proveedores y Órdenes de Compra
- **Estado:** Completado
- **Fecha:** 2026-03-24
- **Archivos nuevos:**
  - `server-fastapi/app/models/supplier.py` (modelo Supplier)
  - `server-fastapi/app/models/purchase_order.py` (modelos PurchaseOrder, PurchaseOrderItem, enum PurchaseOrderStatus)
  - `server-fastapi/app/schemas/supplier.py` (SupplierCreate, SupplierUpdate, SupplierOut)
  - `server-fastapi/app/schemas/purchase_order.py` (schemas completos con ReceivePurchaseOrderInput)
  - `server-fastapi/app/api/routes/suppliers.py` (CRUD completo con soft-delete si tiene OC)
  - `server-fastapi/app/api/routes/purchases.py` (crear, confirmar, recibir, eliminar + actualización de stock via Kardex)
  - `server-fastapi/alembic/versions/0010_add_suppliers_purchases.py` (tablas suppliers, purchase_orders, purchase_order_items)
  - `admin-web/src/features/suppliers/SuppliersPage.tsx` (grid de tarjetas con crear/editar/eliminar)
  - `admin-web/src/features/purchases/PurchasesPage.tsx` (tabla con expandir detalles, crear/confirmar/recibir/eliminar OC)
- **Archivos modificados:**
  - `server-fastapi/app/models/__init__.py` (agregar Supplier, PurchaseOrder, PurchaseOrderItem)
  - `server-fastapi/app/main.py` (rutas suppliers y purchases, compat paths)
  - `admin-web/src/types/index.ts` (tipos Supplier, PurchaseOrder, PurchaseOrderItem y variantes)
  - `admin-web/src/lib/services.ts` (funciones fetchSuppliers, createSupplier, fetchPurchases, confirmPurchase, receivePurchase, etc.)
  - `admin-web/src/App.tsx` (rutas /suppliers y /purchases)
  - `admin-web/src/components/layout/Sidebar.tsx` (ítems Proveedores y Compras)
- **Notas:** Al recibir una OC, el stock de cada producto se actualiza automáticamente con un movimiento RESTOCK en el Kardex referenciado al número de OC. Estados: draft → confirmed → received. Solo las OC en borrador son editables/eliminables.

---

---

### Fase 2.2 — Motor de Promociones
- **Estado:** Completado
- **Fecha:** 2026-03-24
- **Tipos soportados:** percentage_discount, fixed_discount, buy_n_get_m (lleva N paga M), min_quantity (precio especial por volumen)
- **Archivos nuevos:**
  - `server-fastapi/app/models/promotion.py` (modelo Promotion con enum PromotionType)
  - `server-fastapi/app/schemas/promotion.py`
  - `server-fastapi/app/api/routes/promotions.py` (CRUD admin + endpoint público /active para POS)
  - `server-fastapi/alembic/versions/0011_add_promotions.py`
  - `admin-web/src/features/promotions/PromotionsPage.tsx` (tabla con toggle activo/inactivo, crear/editar/eliminar)
  - `client-electron-pos/src/utils/promotions.ts` (computePromotion, getPromoLabel)
- **Archivos modificados:**
  - `server-fastapi/app/models/__init__.py`, `app/main.py` (registro rutas + compat path)
  - `admin-web/src/App.tsx`, `Sidebar.tsx` (ruta y nav /promotions)
  - `client-electron-pos/src/types/index.ts` (tipo Promotion)
  - `client-electron-pos/src/pages/POSPage.tsx` (fetch /promotions/active, applyPromoToItem, handleQuantityChange, badge en carrito)
  - `client-electron-pos/src/components/CategoryGrid.tsx` (badge PROMO verde cuando aplica promoción)
- **Notas:** El POS fetcha promociones activas al iniciar. Al agregar o cambiar cantidad, `computePromotion` calcula el precio efectivo y lo aplica via `updatePrice`. Para buy_n_get_m y min_quantity (dependientes de cantidad), el precio se recalcula en cada cambio de qty. La etiqueta de la promo aparece junto al nombre del ítem en el carrito.

---

---

### Fase 2.5 — Dashboard con Gráficos
- **Estado:** Completado
- **Fecha:** 2026-03-24
- **Archivos nuevos:** ninguno
- **Archivos modificados:**
  - `server-fastapi/app/schemas/dashboard.py` (añadidos: SalesTrendPoint, HourlyPoint, PaymentMethodPoint, TopProductAnalyticsOut)
  - `server-fastapi/app/api/routes/dashboard.py` (4 nuevos endpoints analíticos)
  - `admin-web/src/types/index.ts` (SalesTrendPoint, HourlyPoint, PaymentMethodPoint)
  - `admin-web/src/lib/services.ts` (fetchSalesTrend, fetchHourlySales, fetchPaymentMethods, fetchTopProductsAnalytics)
  - `admin-web/src/features/dashboard/DashboardPage.tsx` (reescrito con 4 gráficos recharts)
- **Notas:**
  - Backend: 4 endpoints bajo `/dashboard/analytics/` — `sales-trend?days=N`, `hourly?days=N`, `payment-methods?days=N`, `top-products?limit=N&days=N`. Todos requieren admin auth.
  - Frontend: KPI cards existentes se mantienen. Se agregan 4 gráficos: línea de tendencia de ingresos, barras verticales por hora, donut de métodos de pago, barras horizontales top productos. Selector de rango (7/14/30 días) compartido para tendencia/hora/pagos; selector independiente para top productos.
  - Se instaló `recharts` en admin-web (`npm install recharts`).

---

### Fase 2.3 — Fidelización de Clientes
- **Estado:** Completado
- **Fecha:** 2026-03-24
- **Archivos nuevos:**
  - `server-fastapi/app/models/customer.py`
  - `server-fastapi/app/schemas/customer.py`
  - `server-fastapi/app/api/routes/customers.py`
  - `server-fastapi/alembic/versions/0012_add_customers.py`
  - `server-fastapi/alembic/versions/0013_add_loyalty_to_sales.py`
  - `admin-web/src/features/customers/CustomersPage.tsx`
- **Archivos modificados:**
  - `server-fastapi/app/models/sale.py` (`customer_id`, `points_earned`, `points_redeemed`, `discount_amount`)
  - `server-fastapi/app/schemas/sale.py` (campos loyalty en SaleCreate y SaleOut)
  - `server-fastapi/app/services/sale_service.py` (canje de puntos + acumulación post-venta)
  - `server-fastapi/app/core/config.py` (`LOYALTY_POINTS_PER_THOUSAND`, `LOYALTY_POINT_VALUE`)
  - `server-fastapi/app/models/__init__.py`, `app/main.py` (registro Customer + ruta)
  - `admin-web/src/types/index.ts`, `lib/services.ts`, `App.tsx`, `Sidebar.tsx`
  - `client-electron-pos/src/types/index.ts` (Customer, LoyaltyConfig)
  - `client-electron-pos/src/components/PaymentModal.tsx` (props loyalty + descuento en UI)
  - `client-electron-pos/src/pages/POSPage.tsx` (strip de cliente, búsqueda, canje de puntos, total efectivo)
- **Notas:**
  - Config por defecto: 1 punto por cada $1.000 gastados; 1 punto = $10 de descuento (ajustable en `.env` con `LOYALTY_POINTS_PER_THOUSAND` / `LOYALTY_POINT_VALUE`).
  - En el POS: strip encima del carrito para buscar cliente por nombre/RUT/teléfono. Al seleccionar, se muestra balance de puntos y campo para ingresar cuántos canjear. El descuento se descuenta del total en tiempo real.
  - Al completar la venta, el toast indica `+N pts` ganados. Los puntos del cliente se actualizan automáticamente en BD.
  - Admin: `/customers` con tabla expandible, historial de compras por cliente, ajuste manual de puntos.

---

### Fase 2.4 — Recibos Digitales
- **Estado:** Completado
- **Fecha:** 2026-03-24
- **Archivos nuevos:**
  - `server-fastapi/app/services/email_service.py` (HTML receipt builder + SMTP sender)
- **Archivos modificados:**
  - `server-fastapi/app/core/config.py` (`SMTP_HOST/PORT/USER/PASSWORD/FROM_NAME/FROM_EMAIL/USE_TLS`, propiedad `smtp_configured`)
  - `server-fastapi/app/api/routes/sales.py` (`POST /{id}/send-receipt`, BackgroundTask)
  - `server-fastapi/app/main.py` (`GET /api/config` expone `smtp_configured`)
  - `admin-web/src/types/index.ts` (`smtp_configured?` en `StoreConfig`)
  - `admin-web/src/features/config/ConfigPage.tsx` (sección SMTP con estado activo/inactivo)
  - `client-electron-pos/src/components/ReceiptPreviewModal.tsx` (input email + botón "Email" con llamada a send-receipt)
- **Notas:**
  - SMTP se activa configurando `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD` en el `.env` del backend.
  - El envío se hace en background (BackgroundTasks de FastAPI) para no bloquear la respuesta.
  - Si SMTP no está configurado, el endpoint retorna HTTP 400 de inmediato.
  - En el POS, el input de email aparece en el modal de preview de boleta, junto a los botones PDF y WhatsApp.
  - En el admin, la página de Configuración muestra si el SMTP está activo o no.

---

### Fase 2.6 — Alertas y Notificaciones
- **Estado:** Completado
- **Fecha:** 2026-03-24
- **Archivos nuevos:**
  - `server-fastapi/app/models/notification.py` (modelo Notification con NotificationType enum)
  - `server-fastapi/app/schemas/notification.py` (NotificationOut)
  - `server-fastapi/app/services/notification_service.py` (create con dedup, check_stock_alerts_for_products, run_stock_alerts, run_slow_mover_check, create_daily_summary)
  - `server-fastapi/app/api/routes/notifications.py` (GET /notifications/, GET /unread-count, POST /{id}/read, POST /read-all)
  - `server-fastapi/alembic/versions/0014_add_notifications.py`
- **Archivos modificados:**
  - `server-fastapi/app/models/__init__.py` (agregar Notification)
  - `server-fastapi/app/main.py` (lifespan con asyncio task periódica + registro de router)
  - `server-fastapi/app/services/sale_service.py` (trigger stock-low post-venta)
  - `server-fastapi/app/api/routes/cash.py` (trigger cash-diff al cerrar sesión con diferencia ≥ $2.000)
  - `admin-web/src/types/index.ts` (interfaz Notification)
  - `admin-web/src/lib/services.ts` (fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead)
  - `admin-web/src/components/layout/TopBar.tsx` (campanita con badge de conteo, panel dropdown con lista de notifs y marca-todo-leído)
- **Notas:**
  - Stock bajo: se crea automáticamente al completar una venta si algún producto queda bajo su `min_stock`. Dedup: 1 vez cada 24 h por producto.
  - Diferencia de caja: se crea al cerrar sesión si la diferencia supera $2.000 (sobrante o faltante).
  - Productos sin movimiento: check periódico cada ~8 h, productos activos con stock > 0 y sin ventas en 30 días. Dedup: 1 vez por semana por producto.
  - Resumen diario: se crea vía task periódica ~1 vez cada 23 h con total de ventas del día.
  - El task periódico corre como coroutine asyncio durante el lifespan de FastAPI (sin dependencias extras).
  - El panel de la campanita hace polling del conteo cada 60 s y carga la lista completa al abrirse.

---

### Fase 3.5 — Sync Cloud / Multi-sucursal
- **Estado:** Completado
- **Fecha:** 2026-03-25
- **Archivos nuevos:**
  - `server-fastapi/app/models/sync_log.py` (modelo SyncLog)
  - `server-fastapi/app/schemas/sync.py` (SyncStatus, SyncConfigOut, SyncLogOut)
  - `server-fastapi/app/services/cloud_sync_service.py` (lógica de sync: 17 tablas con estrategia incremental/full-upsert/joined)
  - `server-fastapi/app/api/routes/sync.py` (GET /status, GET /config, PUT /config, POST /trigger)
  - `server-fastapi/alembic/versions/0017_add_sync_log.py`
  - `admin-web/src/features/sync/SyncPage.tsx` (estado de sync, historial, config Supabase, guía multi-sucursal)
- **Archivos modificados:**
  - `server-fastapi/app/core/config.py` (agregado `BRANCH_ID`)
  - `server-fastapi/requirements.txt` (agregado `supabase==2.11.0`)
  - `server-fastapi/app/models/__init__.py` (SyncLog)
  - `server-fastapi/app/main.py` (router sync)
  - `sync-worker/sync.py` (reescrito: 17 tablas, branch_id, reporte WhatsApp real, `--once` flag, logs en BD)
  - `admin-web/src/types/index.ts` (SyncLog, SyncStatus, SyncConfigOut, SyncConfigUpdate)
  - `admin-web/src/lib/services.ts` (fetchSyncStatus, fetchSyncConfig, updateSyncConfig, triggerSync)
  - `admin-web/src/App.tsx` (ruta /sync)
  - `admin-web/src/components/layout/Sidebar.tsx` (ítem "Sync Cloud" con ícono CloudUpload)
- **Notas:**
  - 17 tablas sincronizadas con estrategia por tipo: incremental (updated_at/created_at), full-upsert (categorías), joined (sale_items, order_items, purchase_order_items).
  - Multi-sucursal: cada registro se taguea con `branch_id` (configurable en .env). Supabase almacena datos de todas las sucursales en las mismas tablas.
  - Sync-worker corre como daemon (cada 30 min) o con `--once` para ejecución única.
  - Reporte WhatsApp diario (22:00) implementado via WhatsApp Business Cloud API (requiere WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_REPORT_TO en .env).
  - Trigger manual desde admin web vía `POST /api/sync/trigger` (background task en FastAPI).
  - Historial de últimas 10 sincronizaciones con duración, estado y errores.
  - Migración 0017 aplicada: tabla `sync_logs` creada.

---

### Fase 3.6 — Integración Transbank
- **Estado:** Completado
- **Fecha:** 2026-03-25
- **Archivos nuevos:**
  - `server-fastapi/alembic/versions/0018_add_card_auth_to_sales.py` (columnas `card_auth_code`, `card_last4` en sales)
- **Archivos modificados:**
  - `server-fastapi/app/models/sale.py` (`card_auth_code VARCHAR(20)`, `card_last4 VARCHAR(4)`)
  - `server-fastapi/app/schemas/sale.py` (campos en SaleCreate y SaleOut)
  - `server-fastapi/app/services/sale_service.py` (pasa card_auth_code y card_last4 al crear la venta)
  - `client-electron-pos/package.json` (`transbank-pos-sdk@^4.0.0`, `asarUnpack` para serialport)
  - `client-electron-pos/electron/main.js` (variable `transbankPOS`, helper `getTransbankPOS()`, 6 IPC handlers: list-ports, connect, disconnect, get-status, sale, close-day)
  - `client-electron-pos/electron/preload.js` (6 métodos Transbank expuestos via contextBridge)
  - `client-electron-pos/src/vite-env.d.ts` (tipos TypeScript para todos los métodos Transbank en ElectronAPI)
  - `client-electron-pos/src/pages/SettingsPage.tsx` (sección "Transbank PINpad": selector de puerto COM, conectar/desconectar, estado, cierre del día)
  - `client-electron-pos/src/components/PaymentModal.tsx` (flujo PINpad en método tarjeta: botón cobrar, estado waiting/approved/failed, auth code + last4 en UI y en el POST de venta)
- **Notas:**
  - SDK: `transbank-pos-sdk@4.0.0` con clase `POSIntegrado`. La instancia se crea lazy en el primer uso.
  - `asarUnpack` es requerido para serialport (módulo nativo) en el build de Electron.
  - Flujo de pago: al seleccionar "Tarjeta" y tener PINpad conectado, el usuario debe primero procesar el pago en el PINpad. El botón "Confirmar Pago" solo se habilita después del resultado aprobado.
  - Los campos `card_auth_code` y `card_last4` se guardan en la BD y aparecen en el historial de ventas.
  - Si el PINpad no está disponible, el método "Tarjeta" sigue funcionando con confirmación manual (compatible hacia atrás).
  - Migración 0018 debe aplicarse: `alembic upgrade head`.

*Última actualización: 2026-03-25*
