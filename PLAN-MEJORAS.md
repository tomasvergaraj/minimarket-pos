# Plan de Mejoras — MiniMarket POS

> Análisis realizado sobre la base de código actual. Objetivo: incrementar valor de venta del producto,
> mejorar experiencia de usuario y gestión del local.

---

## Estado actual del sistema

El sistema ya cuenta con una base sólida:
- Backend FastAPI + PostgreSQL con licencia offline por hardware
- Panel admin web (React/Vite) con dashboard, productos, ventas, caja, inventario, reportes
- Cliente POS Electron con flujo de venta completo (efectivo, tarjeta, transferencia, mixto)
- Kardex de inventario, gestión de categorías, sesiones de caja por caja registradora
- Soporte SII Chile (estructura inicial, no completada)

---

## Fase 1 — Impacto rápido (2-4 semanas)

Mejoras que aumentan el valor percibido del producto sin cambios estructurales grandes.

### 1.1 Imágenes de productos

**Por qué:** El POS actual muestra solo texto. Los cajeros pierden tiempo buscando productos.
Los clientes que miran la pantalla no reconocen lo que se está cobrando.

**Qué hacer:**
- Agregar campo `image_url` (ruta local relativa) al modelo `products`
- Upload de imagen desde el panel admin (guardar en `server-fastapi/static/images/`)
- Endpoint `GET /static/images/{filename}` servido por FastAPI
- Mostrar thumbnail en la grilla del POS Electron
- Mostrar imagen en modal de detalle del producto en admin

**Archivos afectados:**
- `server-fastapi/app/models/product.py`
- `server-fastapi/app/api/routes/products.py`
- `admin-web/src/features/products/` (formulario + tabla)
- `client-electron-pos/src/pages/POSPage.tsx`

---

### 1.2 Grilla de productos en POS con categorías visuales

**Por qué:** El POS solo tiene búsqueda por texto/barcode. Un minimarket maneja
200-500 productos y los cajeros necesitan acceso rápido a los más vendidos.

**Qué hacer:**
- Agregar tab/panel lateral "Acceso rápido" en el POS
- Grilla de botones grandes por categoría (colores ya existen en el modelo)
- Al seleccionar categoría, muestra productos de esa categoría como cards clicables
- Marcar productos como "favoritos" para aparecer en inicio

**Archivos afectados:**
- `client-electron-pos/src/pages/POSPage.tsx`
- `server-fastapi/app/models/product.py` (campo `is_favorite`)

---

### 1.3 Pantalla cliente (Customer Display)

**Por qué:** Es un diferenciador de ventas clave. El cliente ve en tiempo real lo que
se cobra. Genera confianza. Los competidores de $50k+ siempre lo incluyen.

**Qué hacer:**
- Segunda ventana Electron (`customer-display.html`) que se abre automáticamente
- Muestra: ítem actual agregado, lista del carrito, total parcial, monto pagado/cambio
- Se sincroniza via `ipcRenderer`/`ipcMain` (ya existe Electron)
- Pantalla de "bienvenida" configurable con logo y nombre del local cuando no hay venta activa
- Soporte para monitor secundario (se posiciona automáticamente en pantalla 2 si existe)

**Archivos afectados:**
- `client-electron-pos/electron/main.js` (nueva BrowserWindow)
- `client-electron-pos/src/` (nueva página CustomerDisplayPage)
- `client-electron-pos/electron/preload.js`

---

### 1.4 Atajos de teclado en POS

**Por qué:** Los cajeros experimentados son mucho más rápidos con teclado que con mouse.
Reduce tiempo por transacción y errores.

**Qué hacer:**
- `F1` → foco en búsqueda de producto
- `F2` → abrir modal de pago
- `F3` → limpiar carrito (con confirmación)
- `F4` → cobrar en efectivo rápido (monto exacto)
- `+/-` → cambiar cantidad del ítem seleccionado
- `Delete` → eliminar ítem seleccionado del carrito
- `Escape` → cerrar modales
- Indicador visual de atajos disponibles en la interfaz

**Archivos afectados:**
- `client-electron-pos/src/pages/POSPage.tsx`

---

### 1.5 Resumen de turno para cajero

**Por qué:** Al cerrar sesión de caja, el cajero solo ve el total. No hay un resumen
útil para el cajero mismo. Mejorar esto mejora la confianza y control.

**Qué hacer:**
- Al cerrar sesión: mostrar resumen visual con
  - Total ventas por método de pago (barra/gráfico simple)
  - Número de transacciones
  - Ticket promedio
  - Diferencia de caja (esperado vs declarado) con color verde/rojo
  - Botón para imprimir resumen de turno en impresora térmica
- Guardar resumen como PDF opcional (en admin)

**Archivos afectados:**
- `client-electron-pos/src/pages/` (modal de cierre)
- `admin-web/src/features/cash/`
- `server-fastapi/app/api/routes/cash.py`

---

## Fase 2 — Funcionalidades core (1-2 meses)

Estas funciones justifican un precio de venta significativamente mayor.

### 2.1 Gestión de Proveedores y Órdenes de Compra

**Por qué:** Actualmente el inventario solo sube via "ajuste manual" en Kardex.
No hay trazabilidad de compras. Esto es un gap crítico para cualquier minimarket real.

**Qué hacer:**
- Nuevo modelo `suppliers` (RUT, nombre, contacto, teléfono, email, dirección)
- Nuevo modelo `purchase_orders` (proveedor, fecha, estado: borrador/confirmada/recibida)
- Nuevo modelo `purchase_order_items` (producto, cantidad pedida, costo unitario, cantidad recibida)
- Flujo: crear OC → confirmar → marcar como recibida → actualizar stock automáticamente via Kardex
- Página admin: `/suppliers` y `/purchases`
- Reporte de compras vs ventas para ver márgenes reales
- Cálculo automático de costo promedio ponderado

**Valor agregado:** Permite al dueño saber exactamente cuánto gastó en compras y calcular
rentabilidad real por producto.

**Nuevos archivos:**
- `server-fastapi/app/models/supplier.py`
- `server-fastapi/app/models/purchase_order.py`
- `server-fastapi/app/api/routes/suppliers.py`
- `server-fastapi/app/api/routes/purchases.py`
- `admin-web/src/features/suppliers/`
- `admin-web/src/features/purchases/`

---

### 2.2 Motor de Promociones

**Por qué:** El sistema actual solo soporta descuento simple por producto con fecha de expiración.
Los minimarkets modernos necesitan promociones flexibles para competir con supermercados.

**Qué hacer:**
- Nuevo modelo `promotions` con tipos:
  - `percentage_discount` — X% de descuento en producto/categoría
  - `fixed_discount` — $X de descuento
  - `buy_n_get_m` — lleva 3 paga 2
  - `bundle` — precio especial al comprar producto A + producto B juntos
  - `min_quantity` — precio especial al comprar 6 o más unidades
- Vigencia por fecha y hora (inicio/fin)
- Aplicación automática en el POS al agregar al carrito
- Visualización clara en el carrito: precio original tachado + precio con descuento
- Badge "OFERTA" / "PROMO" en la grilla de productos
- Página admin `/promotions` para gestionar

**Valor agregado:** El dueño puede hacer "viernes de descuentos", "2x1 en bebidas",
"precio mayorista" al comprar caja completa, etc.

---

### 2.3 Programa de Fidelización de Clientes

**Por qué:** Es una de las funcionalidades más pedidas en POS para minimarkets.
Permite retención de clientes y datos de comportamiento de compra.

**Qué hacer:**
- Nuevo modelo `customers` (nombre, RUT opcional, teléfono, email, puntos acumulados)
- Sistema de puntos: configurar cuántos puntos por $1.000 comprado
- Canje: X puntos = $Y de descuento
- Búsqueda de cliente en POS por teléfono/RUT antes de cobrar
- Historial de compras por cliente en admin
- Reportes: clientes más frecuentes, ticket promedio por cliente

**Variante simple (MVP):** Solo registro de cliente con historial de compras, sin puntos.
Igual tiene gran valor comercial.

**Nuevos archivos:**
- `server-fastapi/app/models/customer.py`
- `server-fastapi/app/api/routes/customers.py`
- `admin-web/src/features/customers/`
- `client-electron-pos/src/` (integración en POSPage)

---

### 2.4 Recibos Digitales — WhatsApp / Email

**Por qué:** Reduce papel, es moderno, y los clientes lo piden.
WhatsApp es especialmente relevante en Chile.

**Qué hacer:**
- Al finalizar venta: preguntar "¿Desea recibo digital?" con campo para teléfono/email
- Generación de PDF del recibo (usando `reportlab` o `weasyprint`)
- Envío por email via SMTP configurable en admin
- Envío por WhatsApp via API de WhatsApp Business (Twilio o Meta directo)
- Template configurable del recibo (logo, nombre local, RUT)
- Historial de recibos enviados en admin

**Archivos afectados:**
- `server-fastapi/app/services/` (nuevo receipt_service.py)
- `server-fastapi/app/api/routes/sales.py`
- `client-electron-pos/src/pages/POSPage.tsx`
- `admin-web/src/features/config/ConfigPage.tsx`

---

### 2.5 Dashboard con Gráficos Interactivos

**Por qué:** El dashboard actual muestra KPI cards y una tabla simple.
Los dueños de negocio toman decisiones basadas en visualizaciones.

**Qué hacer:**
- Integrar librería de gráficos (Recharts o Chart.js — livianas y compatibles con React)
- Gráfico de ventas por día (últimos 7/30 días) — línea
- Gráfico de ventas por hora del día — barras (para saber horas pico)
- Gráfico de método de pago — dona (efectivo vs tarjeta vs transferencia)
- Top 10 productos más vendidos — barras horizontales
- Mapa de calor semanal (día x hora) — para planificación de personal
- Comparativa semana actual vs semana anterior
- Filtros por rango de fecha y por caja registradora

**Archivos afectados:**
- `admin-web/src/features/dashboard/` (DashboardPage.tsx)
- `server-fastapi/app/api/routes/dashboard.py` (nuevos endpoints de analytics)
- `admin-web/package.json` (agregar recharts)

---

### 2.6 Alertas y Notificaciones

**Por qué:** Los dueños no están siempre mirando el sistema. Necesitan que el sistema
les avise proactivamente de situaciones críticas.

**Qué hacer:**
- **Alertas de stock bajo:** email/WhatsApp cuando producto llega a `min_stock`
  (actualmente solo se muestra en dashboard sin notificación activa)
- **Resumen diario automático:** envío a las 23:00 con ventas del día, top productos, estado de caja
- **Alerta de diferencia de caja:** notificación si diferencia supera umbral configurable
- **Alerta de producto sin movimiento:** productos sin ventas en X días (posible merma o sobre-stock)
- Sistema de notificaciones in-app en el panel admin (campanita)

---

## Fase 3 — Diferenciadores premium (2-4 meses)

Funciones que justifican un tier de precio mayor o licencia "Pro".

### 3.1 Boleta Electrónica SII (Completar integración)

**Por qué:** La integración SII existe en el código pero no está completada.
En Chile, la boleta electrónica es **obligatoria** para muchos rubros.
Completar esto es un requisito legal para muchos clientes potenciales.

**Qué hacer:**
- Completar el servicio `app/tax/sii/` con:
  - Firma digital del XML usando certificado PFX
  - Envío al SII (ambiente certificación y producción)
  - Obtención y almacenamiento del TED (timbre electrónico)
  - Manejo de folios CAF automático
- Impresión del TED en recibo térmico
- Panel admin para gestión de CAF (cuántos folios quedan, alertar si pocos)
- Reenvío manual de boletas fallidas

---

### 3.2 Módulo de Gastos del Local

**Por qué:** Sin registro de gastos, el dueño no puede calcular rentabilidad real.
Las ventas menos el costo de productos no es la ganancia real (hay electricidad, arriendo, etc.)

**Qué hacer:**
- Nuevo modelo `expenses` (monto, categoría, descripción, fecha, comprobante_foto)
- Categorías de gasto: Arriendo, Servicios básicos, Remuneraciones, Insumos, Otros
- Registro desde admin y desde caja (gastos de caja chica)
- Reporte de P&L simplificado: Ventas - Costo productos - Gastos = Utilidad estimada
- Export a Excel mensual para el contador

---

### 3.3 Control de Mesas / Comandas mejorado

**Por qué:** El modelo `orders` ya existe pero está poco desarrollado en el frontend.
Si el minimarket tiene un sector de comidas/cafetería, este módulo es clave.

**Qué hacer:**
- Mapa visual de mesas configurable (drag & drop en admin)
- Estado visual de mesas: libre (verde), ocupada (rojo), cuenta pedida (amarillo)
- Pantalla de cocina (Kitchen Display System) — similar a customer display
- Impresión automática de comanda en impresora de cocina al confirmar pedido
- División de cuentas: mesa para N personas, dividir en partes iguales o por ítem
- Tiempo de ocupación por mesa

---

### 3.4 App Móvil para Dueño (Admin Mobile)

**Por qué:** El dueño no siempre está en el local. Quiere ver las ventas
desde el celular sin necesidad de estar frente al PC.

**Qué hacer:**
- App React Native (Expo) o Progressive Web App (PWA) del panel admin
- PWA es más simple: agregar `manifest.json` y service worker al admin web actual
- Vista optimizada para móvil con:
  - Dashboard con ventas del día
  - Alertas de stock bajo
  - Historial de ventas reciente
  - Apertura/cierre remoto de sesión de caja

**Opción mínima:** Hacer el admin web responsive para móvil (actualmente no lo es).

---

### 3.5 Sincronización Cloud / Multi-sucursal

**Por qué:** El sync-worker con Supabase ya existe en el código pero no está activo.
Permite backups automáticos y futura expansión a múltiples locales.

**Qué hacer:**
- Activar y completar `sync-worker/` con Supabase
- Backup automático de la base de datos cada 24 horas a la nube
- Dashboard web accesible remotamente (con autenticación reforzada)
- Fase 2: soporte multi-sucursal con stock centralizado vs por local
- Reportes consolidados de todas las sucursales

---

### 3.6 Integración con Medios de Pago (Transbank)

**Por qué:** Actualmente el pago con tarjeta se registra manualmente.
La integración con Transbank WebPay automatiza el cobro y elimina errores.

**Qué hacer:**
- Integrar Transbank SDK en el cliente Electron
- Comunicación con PINpad via puerto serial/USB
- El monto se envía automáticamente al PINpad desde el POS
- El resultado (aprobado/rechazado) se registra automáticamente en la venta
- Soporte para WebPay Plus (tarjetas) y OneClick (débito automático)

---

## Resumen de priorización

| # | Funcionalidad | Impacto venta | Esfuerzo | Prioridad |
|---|---------------|:---:|:---:|:---:|
| 1.1 | Imágenes de productos | Alto | Bajo | ALTA |
| 1.2 | Grilla POS con categorías | Alto | Bajo | ALTA |
| 1.3 | Pantalla cliente | Muy Alto | Medio | ALTA |
| 1.4 | Atajos de teclado POS | Medio | Bajo | ALTA |
| 1.5 | Resumen de turno | Medio | Bajo | MEDIA |
| 2.1 | Proveedores y OC | Muy Alto | Alto | ALTA |
| 2.2 | Motor de promociones | Muy Alto | Alto | ALTA |
| 2.3 | Fidelización clientes | Alto | Alto | MEDIA |
| 2.4 | Recibos digitales | Alto | Medio | MEDIA |
| 2.5 | Dashboard con gráficos | Muy Alto | Medio | ALTA |
| 2.6 | Alertas y notificaciones | Alto | Medio | MEDIA |
| 3.1 | Boleta electrónica SII | Crítico (legal) | Alto | ALTA |
| 3.2 | Módulo de gastos | Alto | Medio | MEDIA |
| 3.3 | Mesas/Comandas mejorado | Medio | Alto | BAJA |
| 3.4 | App móvil / PWA admin | Alto | Medio | MEDIA |
| 3.5 | Sync cloud / multi-sucursal | Alto | Muy Alto | BAJA |
| 3.6 | Integración Transbank | Muy Alto | Alto | MEDIA |

---

## Mejoras técnicas recomendadas (deuda técnica)

Estas no son funcionalidades pero mejoran estabilidad y mantenibilidad.

### T1 — Generación de PDF de recibos
Actualmente los recibos son solo por impresora térmica. Agregar generación PDF con
`reportlab` o `weasyprint` para recibos digitales y reportes.

### T2 — Rate limiting en API
Agregar `slowapi` al FastAPI para limitar peticiones y evitar abusos o bugs de loop infinito
en el cliente.

### T3 — Soft delete en productos y usuarios
Actualmente `is_active=False` pero los registros quedan en las queries si no se filtra bien.
Revisar consistencia y agregar filtro global en ORM.

### T4 — Admin web responsive
El panel admin no está optimizado para pantallas pequeñas. Agregar breakpoints responsive
para uso en tablet/móvil.

### T5 — Logs de auditoría
Agregar tabla `audit_log` que registre cambios críticos: quién modificó precio, quién anuló
venta, cambios de stock manuales. Esto es clave para detectar fraude interno.

### T6 — Tests automatizados
El proyecto no tiene tests. Agregar al menos tests de integración para los endpoints críticos
(ventas, stock, caja) con pytest + httpx. Previene regresiones en futuras versiones.

### T7 — Migración a JWT estándar
El sistema usa una implementación custom de JWT. Migrar a `python-jose` o `PyJWT` para
mejor compatibilidad, refresh tokens, y revocación de tokens.

---

## Modelo de licenciamiento sugerido

Basado en las funcionalidades, se propone un modelo de tiers:

| Tier | Precio referencial | Funcionalidades |
|------|-------------------|-----------------|
| **Starter** | $X/única vez | POS completo, admin básico, 1 caja, sin nube |
| **Business** | $X*1.5/única vez | + Proveedores, Promociones, Clientes, Dashboard avanzado |
| **Pro** | $X*2/única vez + suscripción mensual | + SII, Recibos digitales, Alertas, Cloud backup |
| **Enterprise** | Cotización | + Multi-sucursal, Transbank, App móvil, soporte dedicado |

---

*Documento generado: 2026-03-23*
*Basado en análisis del código fuente del repositorio minimarket-pos-main*
