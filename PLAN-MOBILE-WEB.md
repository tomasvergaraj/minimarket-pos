# Plan mobile-web — Alineación con mobile-pos

> Estado actual: ~30% de completitud respecto a mobile-pos (legacy React Native).
> Referencia visual y funcional: `client-electron-pos/` + `mobile-pos/`.

---

## Fase 1 — Correcciones y mejoras base (POS funcional mínimo)

### 1.1 POSPage — Carrito
- [ ] Validación de stock bajo en `addToCart`: mostrar alerta si `stock ≤ min_stock` (no bloquear, solo avisar)
- [ ] Persistencia del carrito en `sessionStorage` (se pierde al recargar)
- [ ] Descuento por ítem: modal por ítem con % o monto fijo, previsualización de precio resultante
- [ ] Edición de precio unitario en carrito (admin only)
- [ ] Validación en vivo de efectivo insuficiente (deshabilitar Confirmar si `cashInput < total`)

### 1.2 POSCashPage — Cierre de caja
- [ ] Mostrar desglose de ventas por método en la vista activa: Efectivo / Tarjeta / Transferencia
- [ ] Quick-fill en conteo físico: botón "Usar monto esperado"
- [ ] Logout visible desde la tab Caja

### 1.3 POSSalesPage — Historial
- [ ] Filtro de rango: Hoy / Esta semana / Todo
- [ ] Filtro por estado: Todas / Completadas / Anuladas
- [ ] En modal expandido: mostrar subtotal, IVA, descuentos, y desglose del pago (efectivo + tarjeta + transferencia + vuelto)
- [ ] Iconos de método de pago (Banknote / CreditCard / ArrowLeftRight)

### 1.4 POSSettingsPage — Información de sesión
- [ ] Mostrar caja activa (nombre + hora de apertura) si hay sesión abierta
- [ ] Indicador de conectividad (online/offline) en tiempo real
- [ ] Versión de la app

---

## Fase 2 — Páginas faltantes (alta prioridad)

### 2.1 Nueva página: Inventario (`/inventory`)
> Referencia: `mobile-pos/app/(pos)/products.tsx`

- [ ] Listado de productos con búsqueda debounced
- [ ] Filtro: Solo bajo stock / Sin stock
- [ ] Indicadores visuales por stock: `text-red-600` sin stock, `text-amber-500` bajo, `text-green-600` ok
- [ ] Modal de detalle por producto:
  - Stock actual y mínimo
  - Precio de costo y precio de venta
- [ ] Admin: Editar precio de venta (inline)
- [ ] Admin: Ajuste de stock con tipo:
  - `restock` — entrada de mercancía
  - `adjustment` — ajuste de inventario
  - `shrinkage` — merma/pérdida
  - Campo de notas opcional
- [ ] Agregar tab "Inventario" en `POSLayout.tsx` (solo visible para `role === 'admin'`)
- [ ] Agregar `POST /api/kardex/` a `services.ts`

### 2.2 Mejoras en buscador (POSPage)
> Referencia: `mobile-pos/app/(pos)/search.tsx`

- [ ] Búsqueda en tiempo real con resultados que muestran stock y SKU
- [ ] Botón "+" directo en cada resultado para agregar sin abrir carrito
- [ ] Mostrar cantidad en carrito sobre el botón si ya fue agregado

---

## Fase 3 — Clientes y lealtad

### 3.1 Búsqueda de cliente en POSPage
> Referencia: `mobile-pos/app/(pos)/index.tsx` líneas 127–235

- [ ] Botón de cliente en header del POS (icono User)
- [ ] Modal de búsqueda de cliente por nombre / RUT / teléfono
- [ ] Mostrar cliente seleccionado en header con puntos disponibles
- [ ] Canje de puntos en checkout: input de puntos a canjear, descuento calculado
- [ ] Al confirmar venta: incluir `customer_id` y `points_to_redeem` en `SaleCreate`
- [ ] Agregar a `services.ts`:
  - `searchCustomers(query)` → `GET /api/customers/?search=`
  - `fetchLoyaltyConfig()` → `GET /api/customers/loyalty-config`

### 3.2 Nueva página: Detalle de cliente (`/customer/:id`)
> Referencia: `mobile-pos/app/(pos)/customer-detail.tsx`

- [ ] Header: nombre, RUT, teléfono, email
- [ ] Stats cards: puntos, visitas, total gastado
- [ ] Admin: Ajuste manual de puntos (+/−) con confirmación
- [ ] Historial de compras (últimas 30): número, fecha, método, puntos ganados
- [ ] Items expandibles por venta
- [ ] Agregar a `services.ts`:
  - `fetchCustomer(id)` → `GET /api/customers/:id`
  - `fetchCustomerHistory(id)` → `GET /api/customers/:id/history`
  - `adjustCustomerPoints(id, delta)` → `POST /api/customers/:id/adjust-points`

---

## Fase 4 — Órdenes y mesas (solo para negocios tipo restaurant)

> Referencia: `mobile-pos/src/components/pos/OrdersModal.tsx`
> Solo mostrar si `businessType === 'restaurant' | 'cafeteria' | 'foodtruck'`

- [ ] Botón "Guardar como orden" en checkout (además de cobrar)
- [ ] Modal de órdenes: listado de órdenes abiertas, con número de mesa / referencia
- [ ] Estado kitchen_ready: badge visual + sonido opcional
- [ ] Convertir orden a venta desde el modal
- [ ] Poll cada 15s para órdenes listas (misma lógica que electron client)
- [ ] Agregar a `services.ts`:
  - `fetchOrders(params)` → `GET /api/orders/`
  - `createOrder(data)` → `POST /api/orders/`
  - `updateOrder(id, data)` → `PUT /api/orders/:id`
  - `fetchTableStatuses()` → `GET /api/tables/status`

---

## Fase 5 — Impresión de boleta

> Referencia: `mobile-pos/src/utils/receiptHtml.ts` + `mobile-pos/src/services/printer.ts`
> En web no hay BT nativo, usar Print API del navegador

- [ ] Generador de HTML de boleta:
  - Logo / nombre del negocio
  - Fecha y hora
  - Número de venta
  - Desglose de ítems (nombre, cantidad, precio unitario, subtotal)
  - Subtotal + IVA + total
  - Método de pago + vuelto
  - Puntos ganados / canjeados
  - Footer personalizable
- [ ] Botón "Ver boleta" en modal de venta completada (éxito)
- [ ] Botón "Imprimir" en detalle de venta del historial
- [ ] Modal de vista previa (iframe o ventana emergente con HTML)
- [ ] `window.print()` para impresión directa
- [ ] En Settings: toggle "Imprimir automáticamente tras venta"
- [ ] En Settings: campo "Nombre del negocio en boleta"
- [ ] Persistir preferencias en localStorage (`pos_print_prefs`)
- [ ] Agregar a `services.ts`:
  - `fetchStoreConfig()` → `GET /api/config`

---

## Fase 6 — Soporte offline

> Referencia: `mobile-pos/src/db/productCache.ts` + `mobile-pos/src/db/saleQueue.ts`
> En web usar IndexedDB (via idb library) o localStorage para caché pequeño

- [ ] Caché de productos en IndexedDB:
  - Guardar lista completa al abrir caja o manualmente
  - Usar caché como fallback cuando no hay red
  - Mostrar fecha y cantidad de productos en caché (Settings)
  - Botón "Sincronizar productos" en Settings
- [ ] Cola de ventas offline:
  - Si falla `createSale`, guardar en cola local (localStorage)
  - Badge con contador de ventas pendientes en header
  - Al reconectar: reenviar cola automáticamente
  - En Settings: botón manual "Reintentar cola" + opción de limpiarla
- [ ] Detección de conectividad:
  - `navigator.onLine` + event listeners `online`/`offline`
  - Banner amarillo en header cuando offline
  - Indicador en Settings

---

## Estructura de archivos sugerida al terminar

```
mobile-web/src/
├── context/
│   └── POSAuthContext.tsx       ← existente
├── hooks/
│   ├── useDebounce.ts           ← extraer desde POSPage
│   ├── useOnlineStatus.ts       ← Fase 6
│   └── useStoreConfig.ts        ← Fase 5
├── lib/
│   ├── api.ts                   ← existente
│   ├── services.ts              ← ampliar por fase
│   ├── receiptHtml.ts           ← Fase 5
│   └── offlineQueue.ts          ← Fase 6
├── pages/
│   ├── POSLoginPage.tsx         ← existente ✓
│   ├── POSLayout.tsx            ← ampliar con tab Inventario
│   ├── POSPage.tsx              ← mejorar fases 1–4
│   ├── POSCashPage.tsx          ← mejorar fase 1
│   ├── POSSalesPage.tsx         ← mejorar fase 1
│   ├── POSSettingsPage.tsx      ← mejorar fases 1, 5, 6
│   ├── POSInventoryPage.tsx     ← Fase 2 (nueva)
│   └── POSCustomerDetailPage.tsx← Fase 3 (nueva)
└── types/
    └── index.ts                 ← ampliar con Customer, Order, TableStatus
```

---

## Resumen por fase

| Fase | Descripción | Impacto | Complejidad |
|------|-------------|---------|-------------|
| 1 | Correcciones base (carrito, caja, historial) | Alto | Baja |
| 2 | Página Inventario + buscador mejorado | Alto | Media |
| 3 | Clientes y lealtad | Medio | Media |
| 4 | Órdenes y mesas | Medio | Alta |
| 5 | Impresión de boleta | Medio | Media |
| 6 | Soporte offline | Alto | Alta |
