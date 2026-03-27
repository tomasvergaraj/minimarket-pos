e# Plan: App Móvil POS — React Native

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

### Fase 1 — Scaffold y autenticación
**Objetivo:** App corriendo en dispositivo físico/emulador con login funcional.

- [ ] 1.1 Crear proyecto: `npx create-expo-app mobile-pos --template expo-template-blank-typescript`
- [ ] 1.2 Instalar dependencias base (ver sección Dependencias)
- [ ] 1.3 Configurar NativeWind (tailwind.config.js + babel.config.js)
- [ ] 1.4 Implementar cliente Axios (`src/api/client.ts`)
  - `baseURL` configurable (IP del servidor en red local)
  - Interceptor request: adjunta `Authorization: Bearer <access_token>`
  - Interceptor response: refresca token en 401 (mismo patrón que `admin-web/src/lib/api.ts`)
- [ ] 1.5 `authStore.ts` con Zustand + MMKV (persistir tokens entre cierres)
- [ ] 1.6 Pantalla Login PIN (`app/(auth)/index.tsx`)
  - Teclado numérico on-screen (4 dígitos)
  - Llamada a `POST /api/users/login/pin`
  - Redirección a POS si rol = cashier | admin
- [ ] 1.7 Auth guard en root layout (redirige a login si no hay token)
- [ ] 1.8 Configurar URL del servidor (pantalla de ajustes o variable de entorno)

**Entregable:** Login con PIN → pantalla vacía del POS.

---

### Fase 2 — Pantalla POS principal (carrito)
**Objetivo:** Flujo completo de venta: buscar producto → agregar → cobrar.

- [ ] 2.1 `cartStore.ts` — estado del carrito (igual que Electron `cartStore`)
  - `items: CartItem[]`, `addItem`, `removeItem`, `updateQty`, `clear`
  - `total`, `subtotal`, `taxAmount` calculados (mismo math que `sale_service.py`)
- [ ] 2.2 Layout de tabs POS (`app/(pos)/_layout.tsx`)
  - Tab 1: Carrito activo
  - Tab 2: Búsqueda productos
  - Tab 3: Comandas/mesas (si aplica)
- [ ] 2.3 Componente `ProductCard` (imagen, nombre, precio, stock)
- [ ] 2.4 Búsqueda de productos (`app/(pos)/search.tsx`)
  - Input con debounce → `GET /api/products/?search=`
  - Scroll infinito (TanStack Query `useInfiniteQuery`)
  - Tap → agrega al carrito
- [ ] 2.5 Escáner de código de barras (`src/hooks/useBarcode.ts`)
  - `expo-camera` con `onBarcodeScanned`
  - Busca producto por barcode → `GET /api/products/?barcode=`
  - Auto-agrega al carrito si hay resultado único
- [ ] 2.6 Carrito (`app/(pos)/index.tsx`)
  - Lista de ítems con cantidad editable
  - Swipe-to-delete por ítem
  - Totales (subtotal, IVA, total)
  - Botón **Cobrar**
- [ ] 2.7 Modal de cobro (`components/pos/PaymentModal.tsx`)
  - Selector método: Efectivo / Tarjeta / Transferencia / Mixto
  - Input monto recibido → calcula vuelto
  - Botón confirmar → `POST /api/sales/`
  - Muestra resumen de boleta tras éxito
  - Vacía carrito

**Entregable:** Venta completa desde búsqueda hasta boleta.

---

### Fase 3 — Gestión de caja
**Objetivo:** Abrir y cerrar turno desde el móvil.

- [ ] 3.1 `sessionStore.ts` — persiste `cash_session_id` y `register_id` activos (MMKV)
- [ ] 3.2 Pantalla apertura de caja (`app/(admin)/cash.tsx`)
  - Selección de caja registradora (`GET /api/cash/registers`)
  - Input monto de apertura
  - `POST /api/cash/sessions/open`
  - Guarda session en store
- [ ] 3.3 Guardia en POS: si no hay sesión abierta, redirige a apertura
- [ ] 3.4 Pantalla cierre de caja
  - Resumen: ventas efectivo, tarjeta, transferencia
  - Input conteo físico de efectivo
  - Diferencia calculada (esperado vs contado)
  - `POST /api/cash/sessions/{id}/close`
- [ ] 3.5 Indicador visual de sesión activa (header/top bar)

**Entregable:** Flujo completo apertura → ventas → cierre de caja.

---

### Fase 4 — Clientes y fidelización
**Objetivo:** Asociar cliente a venta y gestionar puntos.

- [ ] 4.1 Buscador de clientes en PaymentModal
  - Input nombre/RUT → `GET /api/customers/?search=`
  - Muestra puntos disponibles del cliente
- [ ] 4.2 Canje de puntos en cobro
  - Slider/input de puntos a canjear
  - Recalcula total con descuento
  - Envía `points_to_redeem` en `POST /api/sales/`
- [ ] 4.3 Pantalla historial del cliente (`app/(admin)/customers/[id].tsx`)
  - Balance puntos, total compras, última visita
  - `GET /api/customers/{id}/history`

**Entregable:** Ventas con cliente asociado y canje de puntos.

---

### Fase 5 — Historial de ventas y recibos
**Objetivo:** Consultar ventas del día y descargar/imprimir boleta.

- [ ] 5.1 Pantalla historial ventas (`app/(admin)/sales.tsx`)
  - Lista paginada `GET /api/sales/`
  - Filtro por fecha, método de pago
  - Badge estado (completada / anulada)
- [ ] 5.2 Detalle de venta
  - Ítems, totales, método de pago, cliente
  - Botón **Anular** (con confirmación) → `POST /api/sales/{id}/void`
- [ ] 5.3 Descarga de recibo PDF
  - `GET /api/sales/{id}/receipt.pdf` con auth header
  - Abre con `expo-sharing` o `expo-print`
- [ ] 5.4 Impresión Bluetooth (opcional)
  - `react-native-thermal-printer` → impresora térmica BT/WiFi
  - Formato ticket 80mm (mismo que PDF service)

**Entregable:** Consulta de ventas + boleta PDF descargable.

---

### Fase 6 — Consulta de productos e inventario
**Objetivo:** Ver stock y editar precio desde el móvil (rol admin).

- [ ] 6.1 Pantalla productos (`app/(admin)/products.tsx`)
  - Lista con stock, precio, estado
  - Alerta visual stock bajo (`stock <= min_stock`)
- [ ] 6.2 Detalle producto con edición rápida de precio/stock (solo admin)
  - `PUT /api/products/{id}`
- [ ] 6.3 Ajuste de stock manual
  - Input cantidad + motivo → `POST /api/kardex/`

**Entregable:** Gestión básica de inventario desde el móvil.

---

### Fase 7 — Offline básico y configuración
**Objetivo:** App usable aunque la red local falle momentáneamente.

- [ ] 7.1 Cache de productos en SQLite (`expo-sqlite`)
  - Sincronizar catálogo completo al abrir sesión
  - Búsqueda offline contra SQLite si API no responde
- [ ] 7.2 Cola de ventas pendientes
  - Si `POST /api/sales/` falla por red → guardar en SQLite
  - Reintentar automáticamente al recuperar conexión
  - Indicador visual de ventas pendientes de sincronizar
- [ ] 7.3 Pantalla de configuración
  - URL del servidor (IP o dominio)
  - Test de conexión
  - Versión de la app
- [ ] 7.4 Detección de conectividad (`@react-native-community/netinfo`)

**Entregable:** App funcional con red local, resiliente a cortes cortos.

---

### Fase 8 — Build y distribución
**Objetivo:** APK listo para instalar en dispositivos Android.

- [ ] 8.1 Configurar `app.json` (nombre, ícono, splash screen, permisos cámara/BT)
- [ ] 8.2 Build APK con EAS Build (`eas build --platform android --profile preview`)
  - Profile `preview`: APK directo sin Play Store
  - Profile `production`: AAB para Play Store (futuro)
- [ ] 8.3 Instalar en dispositivos de prueba via ADB o QR code
- [ ] 8.4 Ajuste de permisos Android (cámara, Bluetooth, red local)
- [ ] 8.5 Probar en dispositivo físico Android con impresora BT

**Entregable:** APK instalable en Android, probado en hardware real.

---

## Dependencias principales

```json
{
  "dependencies": {
    "expo": "~53.0.0",
    "expo-router": "~4.0.0",
    "react-native": "0.79.x",
    "axios": "^1.7.0",
    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "nativewind": "^4.0.0",
    "tailwindcss": "^3.4.0",
    "react-native-mmkv": "^3.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-camera": "~16.0.0",
    "expo-barcode-scanner": "~13.0.0",
    "expo-sharing": "~12.0.0",
    "expo-file-system": "~18.0.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-hook-form": "^7.0.0",
    "zod": "^3.0.0",
    "@expo/vector-icons": "^14.0.0",
    "react-native-gesture-handler": "~2.20.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "4.14.x"
  },
  "devDependencies": {
    "@babel/core": "^7.0.0",
    "typescript": "~5.3.0",
    "eas-cli": "latest"
  }
}
```

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

## Estimación de trabajo

| Fase | Complejidad | Prioridad |
|---|---|---|
| 1 — Auth | Baja | MVP |
| 2 — POS carrito | Alta | MVP |
| 3 — Caja | Media | MVP |
| 4 — Clientes/puntos | Media | Post-MVP |
| 5 — Historial/recibos | Baja | Post-MVP |
| 6 — Inventario | Baja | Post-MVP |
| 7 — Offline | Alta | Post-MVP |
| 8 — Build APK | Baja | MVP |
