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
| 2.2 | Motor de Promociones | Pendiente |
| 2.3 | Fidelización de Clientes | Pendiente |
| 2.4 | Recibos Digitales | Pendiente |
| 2.5 | Dashboard con Gráficos | Pendiente |
| 2.6 | Alertas y Notificaciones | Pendiente |
| 3.1 | Boleta Electrónica SII | Pendiente |
| 3.2 | Módulo de Gastos | Pendiente |
| 3.3 | Mesas/Comandas mejorado | Pendiente |
| 3.4 | App Móvil / PWA Admin | Pendiente |
| 3.5 | Sync Cloud / Multi-sucursal | Pendiente |
| 3.6 | Integración Transbank | Pendiente |

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

*Última actualización: 2026-03-24*
