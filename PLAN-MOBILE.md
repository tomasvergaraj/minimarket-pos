# Plan: App Móvil POS — React Native

## Contexto

El sistema ya cuenta con:
- **Backend FastAPI** (`/server-fastapi`) — API REST completa con JWT, productos, ventas, caja, clientes, etc.
- **POS Desktop** (`/client-electron-pos`) — Electron + React + Zustand
- **Admin Web** (`/admin-web`) — React + TanStack Query + Tailwind (responsive)

La app móvil será un **nuevo cliente React Native** que consume la misma API FastAPI.
No se modifica el backend (salvo ajustes menores si se detectan).

---

## Arquitectura general

```
┌─────────────────────────────────────────────┐
│           App Móvil (React Native)          │
│                                             │
│  UI (React Native + NativeWind)             │
│  Estado (Zustand)                           │
│  Cache/Offline (MMKV + SQLite)              │
│  API Client (Axios + interceptores JWT)     │
└──────────────────┬──────────────────────────┘
                   │ HTTP/HTTPS
┌──────────────────▼──────────────────────────┐
│         FastAPI Backend (existente)          │
│  /api/users  /api/products  /api/sales       │
│  /api/cash   /api/customers  /api/orders     │
└─────────────────────────────────────────────┘
```

### Decisiones técnicas

| Aspecto | Elección | Motivo |
|---|---|---|
| Framework | React Native (Expo SDK 53) | CLI con acceso nativo completo |
| Navegación | Expo Router v4 (file-based) | Familiar (similar Next.js), deep links |
| Estado global | Zustand | Mismo que Electron — reutilizable |
| Cache API | TanStack Query v5 | Mismo que admin-web |
| Estilos | NativeWind v4 (Tailwind → RN) | Clases familiares del proyecto |
| HTTP | Axios | Mismo cliente que admin-web/electron |
| Almacenamiento | MMKV (sesión) + expo-sqlite (datos offline) | MMKV es ~30× más rápido que AsyncStorage |
| Cámara/Barcode | expo-camera + expo-barcode-scanner | Sin dependencias nativas extra |
| Impresión | react-native-thermal-printer | BT/WiFi thermal printers |
| Iconos | @expo/vector-icons (MaterialCommunityIcons) | Incluido en Expo |
| Formularios | React Hook Form + Zod | Validación consistente con el backend |

---

## Estructura de carpetas

```
mobile-pos/
├── app/                        # Expo Router (rutas)
│   ├── (auth)/
│   │   └── index.tsx           # Login PIN
│   ├── (pos)/
│   │   ├── _layout.tsx         # Tab layout
│   │   ├── index.tsx           # Pantalla principal POS (carrito)
│   │   ├── search.tsx          # Búsqueda de productos
│   │   └── orders.tsx          # Comandas / mesas
│   ├── (admin)/
│   │   ├── _layout.tsx
│   │   ├── cash.tsx            # Apertura/cierre caja
│   │   ├── products.tsx        # Consulta productos
│   │   └── sales.tsx           # Historial ventas
│   └── _layout.tsx             # Root layout (auth guard)
├── src/
│   ├── api/
│   │   ├── client.ts           # Axios + interceptores JWT (refresh token)
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   ├── cash.ts
│   │   ├── customers.ts
│   │   └── users.ts
│   ├── stores/
│   │   ├── authStore.ts        # JWT tokens, usuario, rol
│   │   ├── cartStore.ts        # Carrito de venta activo
│   │   └── sessionStore.ts     # Caja abierta activa
│   ├── components/
│   │   ├── ui/                 # Button, Input, Modal, Badge, etc.
│   │   ├── pos/                # ProductCard, CartItem, NumPad, etc.
│   │   ├── cash/               # OpenSessionForm, CloseSessionSummary
│   │   └── sales/              # SaleReceipt, VoidSaleButton
│   ├── hooks/
│   │   ├── useProducts.ts      # TanStack Query wrappers
│   │   ├── useSales.ts
│   │   └── useBarcode.ts       # Cámara + decodificación
│   ├── types/
│   │   └── index.ts            # Tipos TypeScript (extraídos del proyecto)
│   └── utils/
│       ├── currency.ts         # Formateo CLP
│       ├── tax.ts              # Cálculo IVA
│       └── storage.ts          # MMKV helpers
├── app.json
├── package.json
└── tsconfig.json
```

---

## Fases de implementación

### Fase 1 — Scaffold y autenticación ✅
**Objetivo:** App corriendo en dispositivo físico/emulador con login funcional.

- [x] 1.1 Proyecto creado con Expo SDK 55 + TypeScript
- [x] 1.2 Dependencias instaladas (Axios, Zustand, TanStack Query, NativeWind, AsyncStorage, NetInfo, etc.)
- [x] 1.3 NativeWind configurado (`tailwind.config.js` + `babel.config.js` + `metro.config.js`)
- [x] 1.4 Cliente Axios (`src/api/client.ts`)
  - `baseURL` configurable vía Storage (`server_url`)
  - Interceptor request: adjunta `Authorization: Bearer <access_token>`
  - Interceptor response: refresca token en 401 con cola de requests concurrentes
- [x] 1.5 `authStore.ts` con Zustand + AsyncStorage (persistir tokens entre cierres)
- [x] 1.6 Pantalla Login PIN (`app/(auth)/login.tsx`)
  - Teclado numérico on-screen (6 dígitos) con componente `PinPad`
  - Llamada a `POST /api/users/login/pin`
  - Redirección a POS si rol = cashier | admin
- [x] 1.7 Auth guard en root layout (redirige a login si no hay token)
- [x] 1.8 URL del servidor configurable en login + pantalla Ajustes

**Entregable:** Login con PIN → pantalla vacía del POS. ✅

---

### Fase 2 — Pantalla POS principal (carrito) ✅
**Objetivo:** Flujo completo de venta: buscar producto → agregar → cobrar.

- [x] 2.1 `cartStore.ts` — estado del carrito
  - `items`, `addItem`, `removeItem`, `updateQty`, `updatePrice`, `clear`
  - `cartTotal` y `cartCount` calculados; validación de stock en `addItem`/`updateQty`
- [x] 2.2 Layout de tabs POS (`app/(pos)/_layout.tsx`)
  - Tabs: Venta · Historial · Inventario · Caja · Ajustes (badge carrito en Venta)
- [x] 2.3 Tarjetas de producto renderizadas inline en búsqueda y panel de carrito
  - Nombre, SKU, precio, descuento, stock, badges "Sin stock" / "Solo quedan N"
- [x] 2.4 Búsqueda de productos (`app/(pos)/search.tsx` + inline en `index.tsx`)
  - Debounce 350 ms → `GET /api/products/?search=` · Tap agrega al carrito
- [x] 2.5 Escáner de código de barras (modal con `CameraView` en `app/(pos)/index.tsx`)
  - `expo-camera` con `onBarcodeScanned` + `barcodeScannerSettings`
  - Busca por barcode → `GET /api/products/barcode/{barcode}` (fallback offline)
  - Auto-agrega al carrito; si no existe muestra alerta con opción re-escanear
- [x] 2.6 Carrito panel deslizable (`app/(pos)/index.tsx`)
  - Lista ítems con +/− cantidad, eliminación al llegar a 0, editor de descuento %/fijo
  - Totales (subtotal, IVA, total) · Botón **Cobrar** · *(sin swipe gesture — eliminación vía botón −)*
- [x] 2.7 Modal de cobro (inline en `app/(pos)/index.tsx`)
  - Selector método: Efectivo / Tarjeta / Transferencia / Mixto
  - Input monto → calcula vuelto · Accesos rápidos $1k–$50k
  - Botón confirmar → `POST /api/sales/` · Toggle "Emitir boleta"
  - Resumen vuelto + puntos ganados/canjeados · Vacía carrito · Grid de favoritos

**Entregable:** Venta completa desde búsqueda hasta boleta. ✅

---

### Fase 3 — Gestión de caja ✅
**Objetivo:** Abrir y cerrar turno desde el móvil.

- [x] 3.1 `cashStore.ts` — persiste `cash_session` y `cash_register` en AsyncStorage
- [x] 3.2 Pantalla apertura de caja (`app/(pos)/cash.tsx`)
  - Selección de caja registradora (`GET /api/cash/registers`)
  - Input monto de apertura · `POST /api/cash/sessions/open`
  - Detecta sesiones activas de otros terminales y permite unirse
- [x] 3.3 Guardia en POS: si no hay sesión abierta muestra pantalla "Sin sesión de caja" con botón Ir a Caja
- [x] 3.4 Pantalla cierre de caja (en `app/(pos)/cash.tsx`)
  - Dashboard resumen: ventas efectivo, tarjeta, transferencia, conteo
  - Input conteo físico · Diferencia calculada (esperado vs contado) con color
  - `POST /api/cash/sessions/{id}/close`
- [x] 3.5 Indicador sesión activa en header del POS (nombre de caja, comanda activa)
  - Polling cada 12 s para detectar cierre remoto

**Entregable:** Flujo completo apertura → ventas → cierre de caja. ✅

---

### Fase 4 — Clientes y fidelización ✅
**Objetivo:** Asociar cliente a venta y gestionar puntos.

- [x] 4.1 Buscador de clientes en modal de cobro
  - Input nombre/RUT/teléfono → `GET /api/customers/search` con debounce
  - Muestra nombre, RUT/teléfono y puntos disponibles del cliente seleccionado
- [x] 4.2 Canje de puntos en cobro
  - Input numérico de puntos + botones "Todos" / "Limpiar"
  - Recalcula total con descuento en tiempo real (`loyaltyDiscount`)
  - Envía `points_to_redeem` en `POST /api/sales/`; muestra puntos ganados/canjeados al confirmar
- [x] 4.3 Pantalla historial del cliente (`app/(pos)/customer-detail.tsx`)
  - Stats: balance de puntos, visitas, total compras
  - Datos de contacto: RUT, teléfono, email
  - Admin: panel ajuste de puntos (+/− con input y toggle)
  - Historial de compras expandible con ítems, subtotal, descuento, total
  - `GET /api/customers/{id}` + `GET /api/customers/{id}/history`
  - Accesible desde modal de cobro (botón reloj en tarjeta cliente)

**Entregable:** Ventas con cliente asociado y canje de puntos. ✅

---

### Fase 5 — Historial de ventas y recibos ✅ (parcial)
**Objetivo:** Consultar ventas del día y descargar/imprimir boleta.

- [x] 5.1 Pantalla historial ventas (`app/(pos)/sales.tsx`)
  - Lista paginada `GET /api/sales/` con pull-to-refresh
  - Filtro por rango de fecha (hoy / semana / todo) y estado (completada / anulada)
  - Muestra método de pago, hora, total, conteo de ítems
- [x] 5.2 Detalle de venta (modal deslizable)
  - Ítems, subtotal, IVA, descuento, total, método de pago, cliente asociado
  - Botón **Anular** (con confirmación, solo admin) → `POST /api/sales/{id}/void`
  - Botón **Descargar boleta** → descarga y comparte PDF
- [x] 5.3 Boleta PDF (`src/api/sales.ts` → `downloadReceipt`)
  - `GET /api/sales/{id}/receipt.pdf` con header JWT
  - Descarga a caché local y comparte vía `expo-sharing`
  - Toggle por venta en modal de cobro ("Emitir boleta")
  - Toggle global en Ajustes con descripción contextual
- [x] 5.4 Impresión Bluetooth (`src/services/printer.ts` + `src/stores/printerStore.ts`)
  - `react-native-thermal-printer` v3 vía NativeModules (no rompe el bundle si no está instalado)
  - `printSale(sale, macAddress, storeName)` con formato ESC/POS completo (ítems, totales, pago, puntos)
  - Botón "Imprimir" en detalle de venta (`sales.tsx`)
  - Auto-impresión post-venta configurable (`index.tsx`) junto con la boleta PDF
  - Sección "Impresora Bluetooth" en Ajustes: selector de dispositivo, nombre del negocio, toggle auto-print
  - Graceful degradation: muestra aviso si módulo nativo no está compilado
  - Requiere: `npm install react-native-thermal-printer` + `eas build`

**Entregable:** Consulta de ventas + boleta PDF descargable. ✅

---

### Fase 6 — Consulta de productos e inventario ✅
**Objetivo:** Ver stock y editar precio desde el móvil (rol admin).

- [x] 6.1 Pantalla productos (`app/(pos)/products.tsx`)
  - Lista con búsqueda, debounce 350 ms, pull-to-refresh
  - Badges de stock: rojo "Sin stock" / naranja "Stock bajo" (`stock <= min_stock`)
  - Filtro toggle "Solo stock bajo"
- [x] 6.2 Edición rápida de precio (solo admin) en modal de detalle
  - Input precio de venta + `PUT /api/products/{id}`
- [x] 6.3 Ajuste de stock manual (solo admin)
  - Tipos: Entrada / Ajuste / Merma con ícono y color
  - Input cantidad + notas → `POST /api/kardex/`; muestra stock antes/después

**Entregable:** Gestión básica de inventario desde el móvil. ✅

---

### Fase 7 — Offline básico y configuración
**Objetivo:** App usable aunque la red local falle momentáneamente.

- [x] 7.1 Cache de productos en AsyncStorage (`src/db/productCache.ts`)
  - Sincroniza catálogo completo al abrir sesión (`syncProductCache`, paginado de 500)
  - Búsqueda offline contra caché si API no responde (`searchOffline`, `getByBarcodeOffline`)
  - Fallback transparente en `searchProducts` y `getByBarcode`
  - Gestión desde Ajustes: ver conteo/fecha, forzar sync, limpiar
- [x] 7.2 Cola de ventas pendientes (`src/db/saleQueue.ts`)
  - Si `POST /api/sales/` falla por red → `enqueue()` y alerta al cajero
  - `flushQueue()` al detectar reconexión via NetInfo (auto-retry)
  - Badge `upload-cloud` con conteo en header del POS
  - Banner offline con conteo de productos en caché
  - Gestión desde Ajustes: ver conteo, limpiar cola
- [x] 7.3 Pantalla de configuración (`app/(pos)/settings.tsx`)
  - URL del servidor (IP o dominio) + guardar
  - Test de conexión al servidor
  - Versión de la app (expo-constants)
  - Indicador de conectividad en tiempo real
- [x] 7.4 Detección de conectividad (`@react-native-community/netinfo`) — en Settings y en tiempo real

**Entregable:** App funcional con red local, resiliente a cortes cortos.

---

### Fase 8 — Build y distribución
**Objetivo:** APK listo para instalar en dispositivos Android.

- [x] 8.1 Configurar `app.json`
  - Nombre "Nexo POS", package `com.nexo.pos`, scheme `nexopos`
  - Íconos adaptativos, splash screen, orientación portrait
  - Permisos declarados: CAMERA, INTERNET, ACCESS_NETWORK_STATE, BLUETOOTH (×4)
- [x] 8.4 Permisos Android configurados en `app.json` (cámara, Bluetooth, red)
- [x] 8.2 `eas.json` configurado con perfiles preview (APK) y production (AAB)
  - `eas build --platform android --profile preview` → APK directo
  - `eas build --platform android --profile production` → AAB Play Store
  - *(ejecutar requiere cuenta EAS y `eas-cli` instalado globalmente)*
- [ ] 8.3 Instalar en dispositivos de prueba via ADB o QR code *(pendiente — hardware)*
- [ ] 8.5 Probar en dispositivo físico Android con impresora BT *(pendiente — hardware)*

**Entregable:** APK instalable en Android, probado en hardware real.

---

## Dependencias instaladas (reales)

```json
{
  "dependencies": {
    "expo": "~55.0.8",
    "expo-router": "~55.0.7",
    "react": "19.2.0",
    "react-native": "0.83.2",
    "axios": "^1.13.6",
    "zustand": "^5.0.12",
    "@tanstack/react-query": "^5.95.2",
    "twrnc": "^4.16.0",
    "tailwindcss": "^3.3.5",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "expo-camera": "~55.0.11",
    "expo-barcode-scanner": "^13.0.1",
    "expo-sharing": "~55.0.14",
    "expo-file-system": "~55.0.11",
    "expo-constants": "~55.0.9",
    "expo-linear-gradient": "~55.0.9",
    "@react-native-community/netinfo": "11.5.2",
    "react-hook-form": "^7.72.0",
    "zod": "^4.3.6",
    "@expo/vector-icons": "^15.1.1",
    "react-native-gesture-handler": "~2.30.0",
    "react-native-reanimated": "4.2.1",
    "react-native-safe-area-context": "~5.6.2",
    "react-native-screens": "~4.23.0"
  },
  "devDependencies": {
    "typescript": "~5.9.2",
    "babel-preset-expo": "^55.0.12"
  }
}
```

> **Nota:** Se usa `AsyncStorage` en lugar de `MMKV` (no instalado) y `twrnc` en lugar de `NativeWind` completo.

---

## Tipos TypeScript reutilizables

Copiar/adaptar desde `admin-web/src/types/index.ts` y `client-electron-pos/src/types/index.ts`:

```typescript
// src/types/index.ts
export interface Product {
  id: string
  sku: string
  barcode?: string
  name: string
  sell_price: number
  cost_price: number
  tax_rate: number
  stock: number
  min_stock?: number
  image_url?: string
  is_pack: boolean
  units_contained: number
  discount_price?: number
  discount_ends_at?: string
  is_on_offer?: boolean
  is_active: boolean
}

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  subtotal: number
}

export interface CashSession {
  id: string
  register_id: string
  status: 'open' | 'closed'
  opening_amount: number
  total_cash_sales: number
  total_card_sales: number
  total_transfer_sales: number
  total_sales_count: number
  opened_at: string
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed'

export interface SaleCreate {
  cash_session_id: string
  register_id: string
  seller_id?: string
  items: { product_id: string; quantity: number; unit_price_override?: number }[]
  payment_method: PaymentMethod
  cash_amount: number
  card_amount: number
  transfer_amount: number
  customer_id?: string
  points_to_redeem?: number
}
```

---

## Patrones a reutilizar del proyecto actual

### Cliente API (mismo patrón que `admin-web/src/lib/api.ts`)
```typescript
// src/api/client.ts
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({ baseURL: getServerUrl(), timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access_token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Mismo interceptor de refresh token que api.ts del admin-web
api.interceptors.response.use(
  (r) => r,
  async (error) => { /* refresh flow */ }
)
```

### Cálculo de totales (mismo math que `sale_service.py`)
```typescript
// src/utils/tax.ts
export function calcLineTotal(unitPrice: number, qty: number, taxRate: number) {
  const lineTotal = unitPrice * qty
  const lineTax = Math.round((lineTotal * taxRate / (100 + taxRate)) * 100) / 100
  return { lineTotal, lineTax }
}
```

### Formato moneda CLP
```typescript
// src/utils/currency.ts
export const clp = (v: number) =>
  `$${Math.round(v).toLocaleString('es-CL')}`
```

---

## Consideraciones de seguridad

- Tokens JWT almacenados en **MMKV** (encriptado, más seguro que AsyncStorage)
- PIN nunca almacenado — solo el JWT resultante
- URL del servidor configurable (no hardcodeada) para soportar diferentes sucursales
- Licencia validada contra el backend en cada apertura de sesión
- En Android: `android:usesCleartextTraffic="true"` solo para red local (desarrollo)
  - En producción: usar HTTPS con certificado válido

---

## Scope MVP (versión inicial)

Para tener un POS funcional lo antes posible, el orden mínimo es:

```
Fase 1 (Auth) → Fase 3 (Caja) → Fase 2 (POS) → Fase 8 (Build)
```

Con esto el cajero puede: **abrir turno → cobrar ventas → cerrar turno → instalar APK**.

Las fases 4-7 son mejoras progresivas sobre ese núcleo.

---

## Estado de implementación

| Fase | Estado | Pendiente |
|---|---|---|
| 1 — Auth | ✅ Completo | — |
| 2 — POS carrito | ✅ Completo | Swipe-to-delete (opcional) |
| 3 — Caja | ✅ Completo | — |
| 4 — Clientes/puntos | ✅ Completo | — |
| 5 — Historial/recibos | ✅ Completo | — |
| 6 — Inventario | ✅ Completo | — |
| 7 — Offline | ✅ Completo | — |
| 8 — Build APK | 🔧 Parcial | Ejecutar EAS Build + prueba en hardware |
