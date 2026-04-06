# Guía Personal del Vendedor: Nexo POS — instalación, licencias y planes

> Actualizada: abril 2026. Refleja el estado actual del proyecto con 5 componentes.

Esta guía está pensada para ti como vendedor/implementador. El objetivo es que puedas:

1. Preparar tu kit comercial una sola vez.
2. Instalar el sistema completo desde cero en un cliente.
3. Dejar operativas una o varias cajas.
4. Emitir y activar licencias offline sin exponer tu clave privada.

Los ejemplos asumen Windows 10/11 y una carpeta de trabajo como `C:\Nexo\minimarket-pos`.

---

## 1. Qué compone el sistema hoy

El sistema tiene **5 piezas activas**:

| Componente | Descripción | Dónde corre |
|---|---|---|
| `server-fastapi/` | Backend FastAPI + PostgreSQL | PC servidor del cliente |
| `admin-web/` | Panel de administración web | Servido por el backend en `/admin` |
| `mobile-web/` | POS PWA para tablet/celular | Servido por el backend en `/pos` |
| `client-electron-pos/` | App de caja escritorio (Electron) | Cada PC de caja |
| `sync-worker/` | Backup cloud opcional (Supabase) | PC servidor o servidor externo |

### Arquitectura según plan vendido

**Plan básico / tablet:**
```
PC servidor (backend + admin + mobile-web PWA)
        ↑
Tablet o celular abre /pos en el navegador → POS completo sin instalar nada
```

**Plan estándar / escritorio:**
```
PC servidor (backend + admin + mobile-web)
        ↑
1–3 PCs de caja con app Electron instalada
```

**Plan completo:**
```
PC servidor (backend + admin + mobile-web + sync-worker)
        ↑
PCs caja Electron + tablets con PWA
        ↑
Backup automático en Supabase Cloud
```

### Qué puede hacer el POS móvil (mobile-web)

El POS PWA es una aplicación web completa que corre en cualquier navegador sin instalación:

- Venta con buscador de productos, favoritos, código de barras (cámara)
- Carrito con descuentos por ítem y edición de precio (admin)
- 4 métodos de pago: tarjeta, efectivo, transferencia, mixto
- Clientes con programa de puntos/lealtad
- Comandas (guardar pedido antes de cobrar)
- Historial de ventas con filtros
- Inventario con ajuste de stock y kardex (admin)
- Soporte offline con cola de ventas pendientes
- Boleta de vista previa e impresión por el navegador
- Instalable como PWA en Android/iOS (ícono en pantalla de inicio)

Es funcionalmente equivalente al cliente Electron para la mayoría de negocios que no necesitan impresión térmica directa por USB.

---

## 2. Lo que debes preparar una sola vez como vendedor

### 2.1. Generar tu sistema de licencias

Haz esto una sola vez en tu máquina de trabajo:

```powershell
python scripts/generate_license_keypair.py --private-out secrets/license-private.pem --public-out server-fastapi/license-public.pem
```

Resultado:

- `secrets/license-private.pem`: tu clave privada. **Nunca se entrega al cliente.**
- `server-fastapi/license-public.pem`: clave pública que va en cada servidor cliente.

Regla comercial:

- Usa la misma clave privada para todos tus clientes de esta línea de producto.
- Respáldala en 2 lugares seguros.
- No la copies al PC del cliente.

### 2.2. Compilar admin-web

Antes de compilar `admin-web`, revisa `admin-web/.env`:

```env
VITE_USE_MOCKS=false
```

Deja `VITE_API_URL` **sin definir** para que use el mismo origen del servidor. Si lo hardcodeas a `localhost`, el panel fallará cuando se abra desde otra máquina de la red.

### 2.3. Compilar mobile-web (POS PWA)

```powershell
cd mobile-web
npm install
npm run build
```

El resultado queda en `mobile-web/dist/` y el backend lo sirve automáticamente en `/pos`.

No necesitas hacer nada más: el instalador del servidor ya incluye este paso.

### 2.4. Compilar el instalador Electron (si vendes plan escritorio)

```powershell
cd client-electron-pos
npm install
npm run electron:build
```

Archivo resultante: `client-electron-pos/dist-electron/Nexo-Setup-<version>.exe`

Ese `.exe` es el que instalas en cada caja escritorio.

### 2.5. Carpeta comercial recomendada

```text
Nexo-Ventas/
  repo-maestro/
  instaladores/
    Nexo-Setup-1.x.x.exe
  secretos/
    license-private.pem        ← NUNCA al cliente
  clientes/
    Don-Pedro/
      notas-instalacion.txt
      request-code.txt
      licencia-emitida.json
      datos-comerciales.txt
```

### 2.6. Generar paquete limpio para entrega

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\prepare-delivery.ps1 -CustomerName "Don Pedro"
```

Si vendiste backup cloud:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\prepare-delivery.ps1 -CustomerName "Don Pedro" -IncludeSyncWorker
```

---

## 3. Datos y archivos que debes pedir por cliente

Antes de instalar, reúne:

- nombre comercial del local
- RUT del negocio
- dirección
- cantidad de cajas vendidas (Electron + tablets si aplica)
- PIN administrador
- PIN cajero inicial
- correo y teléfono de contacto
- si quiere SII: certificado `.pfx`, password y CAF XML real
- si quiere backup cloud: `SUPABASE_URL` y `SUPABASE_KEY`

Hardware mínimo recomendado:

- 1 PC servidor Windows 10/11 (puede ser el mismo PC caja en instalaciones pequeñas)
- red LAN estable
- 1 impresora térmica por caja si va a imprimir tickets físicos
- lector de código de barras USB (opcional, el POS móvil usa la cámara)

---

## 4. Instalación del servidor desde cero

### 4.1. Comando recomendado (instalación automática)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-server.ps1 `
  -StoreName "Almacén Don Pedro" `
  -StoreRut "76.123.456-7" `
  -StoreAddress "Av. Principal 123, Santiago" `
  -AdminPin "2580" `
  -CashierPin "1590" `
  -RegisterCount 2 `
  -DatabaseName "minimarket_pos" `
  -DatabaseUser "minimarket_pos" `
  -DatabasePassword "Cambia-Esta-Clave-2026"
```

Si PostgreSQL ya existe en el PC:

```powershell
... -PostgresSuperPassword "CLAVE-POSTGRES"
```

En puerto alternativo (si 8000 ya está ocupado):

```powershell
... -ServerPort 8001
```

Qué hace el instalador:

- instala Python, Node.js, PostgreSQL si faltan
- crea base de datos y usuario
- crea `server-fastapi/.env`
- crea `venv` e instala dependencias del backend
- compila `admin-web` y `mobile-web`
- inicializa tablas y datos base
- abre el puerto en el firewall
- instala el servicio Windows `MiniMarketPOS-Server`

### 4.2. Parámetros comerciales que debes ajustar siempre

- `-RegisterCount`: debe coincidir con las cajas vendidas en el plan
- `-AdminPin`, `-CashierPin`: nunca dejes `1234` o `0000` en cliente real
- `-StoreName`, `-StoreRut`, `-StoreAddress`: datos reales del negocio
- `-ServerPort`: usa `8001` si `8000` ya está ocupado

Con datos de demostración (solo para capacitación):

```powershell
... -WithDemoData
```

### 4.3. Instalación manual si el script falla

Ver sección detallada en la guía anterior (sección 5.4). Resumen:

1. Instalar Python 3.11+, PostgreSQL 15+, Node.js 20+
2. Crear base de datos y usuario
3. Crear venv e instalar dependencias del backend
4. Compilar admin-web y mobile-web
5. Ejecutar `bootstrap.py`
6. Instalar servicio Windows con `install_service.py install`

---

## 5. Ajustes obligatorios después de instalar

Edita `server-fastapi/.env` y agrega o valida:

```env
LICENSE_PUBLIC_KEY_PATH=C:/Nexo/minimarket-pos/server-fastapi/license-public.pem
LICENSE_TRIAL_DAYS=30
LICENSE_CLOCK_SKEW_MINUTES=90
```

Si vendiste backup cloud:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-clave
```

Si vendiste boleta electrónica SII:

```env
SII_ENABLED=true
SII_AMBIENTE=certification
SII_CERT_PFX_PATH=C:/ruta/certificado.pfx
SII_CERT_PFX_PASSWORD=tu-clave
SII_CAF_XML_PATH=C:/ruta/caf_39.xml
STORE_GIRO=COMERCIO AL POR MENOR DE ALMACENES
STORE_ACTECO=521010
STORE_COMUNA=Santiago
STORE_CIUDAD=Santiago
```

Después de editar `.env`, reinicia el servicio:

```powershell
Restart-Service -Name "MiniMarketPOS-Server" -Force
```
(como Administrador) o desde `Servicios > Nexo Backend > Reiniciar`.

---

## 6. Verificación del servidor

Comprueba esto antes de instalar cajas:

- API: `http://localhost:<puerto>/api/health`
- Panel admin: `http://localhost:<puerto>/admin`
- POS móvil: `http://localhost:<puerto>/pos`
- En red LAN: `http://IP_DEL_SERVIDOR:<puerto>/admin`

Credenciales iniciales:

- PIN admin: el definido en la instalación
- PIN cajero: el definido en la instalación

---

## 7. Instalación de cada caja

### 7.1. Caja escritorio (Electron)

1. Instala `Nexo-Setup-<version>.exe`
2. Abre Nexo → `Configurar servidor` → ingresa `http://IP_DEL_SERVIDOR:<puerto>`
3. Inicia sesión con PIN
4. Selecciona la caja correspondiente
5. En Configuración, elige la impresora térmica
6. Haz una venta de prueba e imprime un ticket

### 7.2. Caja tablet / celular (POS móvil)

1. En el dispositivo, abre el navegador (Chrome o Safari)
2. Ve a `http://IP_DEL_SERVIDOR:<puerto>/pos`
3. Ingresa PIN
4. Selecciona la caja
5. Para instalar como PWA: en Chrome → menú → "Agregar a pantalla de inicio"
6. La app quedará con ícono en el dispositivo y funciona sin internet (con cola offline)

Ventaja para el cliente: no necesita instalar ni actualizar nada. Se actualiza solo cuando el servidor se actualiza.

---

## 8. Flujo correcto para vender licencias offline

### 8.1. Obtener el request code del cliente

- En `Admin > Configuración > Licencia Offline`
- O en la app POS, como admin en `Ajustes`

### 8.2. Emitir la licencia en tu máquina

Con menú interactivo:

```powershell
.\issue-license-menu.bat
```

Por comando directo:

```powershell
python scripts/issue_license.py `
  --private-key secrets/license-private.pem `
  --request-code "<codigo>" `
  --customer "Almacén Don Pedro" `
  --max-registers 2 `
  --updates-until 2027-04-01T23:59:59Z `
  --out licenses/don-pedro.json
```

Opciones útiles:

- `--license-type perpetual`: sin fecha de expiración
- `--duration-days 365`: licencia anual
- `--duration-days 30`: demo
- `--expires-at 2027-12-31T23:59:59Z`: fecha exacta
- `--feature sii --feature backup`: módulos habilitados

### 8.3. Activar la licencia en el cliente

1. Panel admin → `Configuración > Licencia Offline`
2. Pega el JSON firmado
3. Pulsa `Activar licencia`
4. Verifica que el estado pase a `licensed`

### 8.4. Regla de oro

La licencia queda atada al `installation_id` + `hardware_hash` del servidor. Si el cliente cambia el PC servidor o reinstala Windows, necesita un request code nuevo y debes reemitir la licencia.

---

## 9. Planes de venta sugeridos

### 9.1. Plan Básico — Tablet POS

**Para quién:** almacenes pequeños, carnicerías, fruterías, negocios con 1 punto de venta y sin PC dedicada a caja.

**Qué incluye:**
- Backend + admin web
- POS móvil (tablet o celular, 1 caja)
- Instalación y capacitación
- 1 año de actualizaciones

**Cómo instalar:**
```powershell
-RegisterCount 1
```
```powershell
--max-registers 1 --duration-days 365
```

**Argumento de venta:** no necesita PC de caja. Con una tablet de $80.000 y conexión al servidor ya tiene POS completo.

**Precio sugerido:** $180.000 – $220.000 instalación + $60.000 – $80.000/año renovación

---

### 9.2. Plan Estándar — 1 Caja

**Para quién:** minimarkets, tiendas, farmacias pequeñas con 1 PC de caja.

**Qué incluye:**
- Backend + admin web
- App Electron en 1 PC caja
- POS móvil habilitado (para supervisor o segunda caja improvisada)
- Programa de lealtad de clientes
- Inventario con kardex
- Historial de ventas
- 1 año de actualizaciones

**Cómo instalar:**
```powershell
-RegisterCount 1
```
```powershell
--max-registers 1 --duration-days 365
```

**Precio sugerido:** $280.000 – $350.000 instalación + $80.000 – $100.000/año renovación

---

### 9.3. Plan Negocio — Hasta 3 Cajas

**Para quién:** minimarkets medianos, supermercados pequeños, negocios con 2–3 puntos de venta simultáneos.

**Qué incluye todo lo del Estándar más:**
- Hasta 3 cajas (Electron o PWA, combinables)
- Backup cloud Supabase
- Comandas / órdenes de pedido
- Panel de informes y dashboard
- 1 año de actualizaciones

**Cómo instalar:**
```powershell
-RegisterCount 3 -IncludeSyncWorker
```
```powershell
--max-registers 3 --duration-days 365 --feature backup
```

**Precio sugerido:** $450.000 – $550.000 instalación + $120.000 – $150.000/año renovación

---

### 9.4. Plan Premium — Hasta 6 Cajas + SII

**Para quién:** negocios formalizados que necesitan boleta electrónica SII, múltiples cajas o sucursales.

**Qué incluye todo lo del Negocio más:**
- Hasta 6 cajas
- Módulo boleta electrónica SII (requiere certificado real del cliente)
- Soporte prioritario
- 1 año de actualizaciones

**Cómo instalar:**
```powershell
-RegisterCount 6 -IncludeSyncWorker
```
```powershell
--max-registers 6 --duration-days 365 --feature backup --feature sii
```

**Precio sugerido:** $700.000 – $900.000 instalación + $200.000 – $250.000/año renovación

---

### 9.5. Plan Perpetuo — Sin renta mensual

Para clientes que prefieren pagar una vez y no tener compromisos anuales. Adecuado para clientes mayores o desconfiados de suscripciones.

**Estructura:**
- Precio más alto que el plan anual (2–2.5x el valor de instalación)
- Incluye actualizaciones por 12 meses (`--updates-until`)
- Pasado el año, el sistema sigue funcionando pero sin actualizaciones
- Si quieren actualizaciones nuevamente, pagan una cuota de renovación menor

```powershell
--license-type perpetual --updates-until 2027-04-01T23:59:59Z
```

**Precio sugerido (1 caja):** $450.000 – $500.000 pago único
**Precio sugerido (3 cajas):** $700.000 – $800.000 pago único
**Renovación de actualizaciones:** $60.000 – $80.000/año

---

### 9.6. Módulos adicionales (add-ons)

Puedes vender estos por separado o incluirlos en planes superiores:

| Módulo | Descripción | Precio sugerido |
|---|---|---|
| **Backup Cloud** | Sincronización automática a Supabase. Recuperación ante pérdida de PC | $40.000/año |
| **Boleta SII** | Emisión de boleta electrónica. Requiere certificado del cliente | $120.000/año |
| **Cajas adicionales** | Agregar 1 caja extra a cualquier plan | $80.000/caja/año |
| **Capacitación extra** | Jornada de 2h para personal nuevo | $40.000/sesión |
| **Soporte remoto** | Atención por TeamViewer para problemas técnicos | $20.000/incidente o $80.000/año |

---

### 9.7. Comparativa rápida de planes

| | Básico Tablet | Estándar | Negocio | Premium |
|---|:---:|:---:|:---:|:---:|
| Cajas | 1 (PWA) | 1 | 3 | 6 |
| App Electron | ✗ | ✓ | ✓ | ✓ |
| POS móvil PWA | ✓ | ✓ | ✓ | ✓ |
| Admin web | ✓ | ✓ | ✓ | ✓ |
| Lealtad clientes | ✓ | ✓ | ✓ | ✓ |
| Inventario | ✓ | ✓ | ✓ | ✓ |
| Comandas | ✗ | ✗ | ✓ | ✓ |
| Backup cloud | ✗ | ✗ | ✓ | ✓ |
| SII boleta | ✗ | ✗ | ✗ | ✓ |
| Actualizaciones | 1 año | 1 año | 1 año | 1 año |

---

## 10. Cuándo vender PWA vs Electron

### Recomienda POS móvil (PWA) cuando:

- El cliente tiene tablet o celular que quiere aprovechar
- No hay presupuesto para PC de caja adicional
- El negocio es pequeño y una sola persona despacha
- El cliente ya tiene el servidor y quiere una segunda caja de emergencia
- Negocios tipo restorán/cafetería donde el mozo toma el pedido en mesa

### Recomienda Electron cuando:

- El cliente necesita impresora térmica USB directa
- El PC ya existe y tiene Windows
- Necesitan lector de barras USB siempre conectado
- El cliente quiere que funcione sin abrir el navegador

### Combinación recomendada para la mayoría:

1 PC caja con Electron como caja principal + tablet con PWA como caja de respaldo o para el supervisor.

---

## 11. Advertencias comerciales importantes

### 11.1. `updates_until` es informativo hoy

La fecha de actualizaciones queda guardada y visible, pero no bloquea automáticamente el sistema. El bloqueo es tu decisión comercial al renovar o no la licencia.

### 11.2. El límite de cajas debes ordenarlo desde la instalación

El sistema valida el límite al **crear** nuevas cajas, pero no desactiva cajas que ya existan. Instala siempre con `-RegisterCount` igual al plan vendido.

### 11.3. El POS móvil no imprime por USB

El PWA usa `window.print()` del navegador. Funciona bien con impresoras de red o PDF. Para impresora térmica USB directa, necesitas el cliente Electron.

### 11.4. Auto-update del cliente Electron

El cliente Electron usa `electron-updater` y apunta a GitHub. Antes de vender actualizaciones automáticas, revisa `client-electron-pos/package.json`:
- `build.publish.owner`
- `build.publish.repo`

---

## 12. Qué guardar por cliente

Por cada cliente conserva:

- nombre y datos del negocio
- plan vendido y cantidad de cajas
- PINs entregados
- request code o JSON de solicitud
- licencia emitida (`licenses/<cliente>.json`)
- fecha de venta y expiración
- fecha de `updates_until`
- notas de hardware del servidor (IP local, nombre equipo)

Si el cliente pierde la licencia, puedes reactivarla en minutos si tienes el JSON guardado.

---

## 13. Checklist final de entrega

Antes de cerrar la instalación verifica:

- [ ] Backend responde en `http://IP_DEL_SERVIDOR:<puerto>/api/health`
- [ ] Panel admin abre en `http://IP_DEL_SERVIDOR:<puerto>/admin`
- [ ] POS móvil abre en `http://IP_DEL_SERVIDOR:<puerto>/pos`
- [ ] Licencia activada y estado `licensed`
- [ ] Cantidad de cajas creadas coincide con lo vendido
- [ ] Cada caja apunta al servidor correcto
- [ ] Cajero puede abrir y cerrar caja desde cada punto
- [ ] POS móvil funciona desde tablet o celular del cliente
- [ ] Admin puede entrar al panel y ve productos/ventas
- [ ] Si tiene Electron: imprime ticket de prueba
- [ ] Hora y fecha del servidor correctas
- [ ] `.env` tiene `LICENSE_PUBLIC_KEY_PATH`
- [ ] Guardaste copia de la licencia emitida

---

## 14. Comandos rápidos de uso diario

Emitir licencia con menú:
```powershell
.\issue-license-menu.bat
```

Reiniciar servicio backend (como administrador):
```powershell
Restart-Service -Name "MiniMarketPOS-Server" -Force
```

Ver log del servidor:
```
server-fastapi/logs/windows-service-host.log
```

Compilar POS móvil:
```powershell
cd mobile-web && npm run build
```

Compilar instalador Electron:
```powershell
cd client-electron-pos && npm run electron:build
```

---

## 15. Flujo recomendado para cada nueva venta

1. Define plan: cuántas cajas, tipo (Electron/PWA/ambos), módulos opcionales
2. Instala servidor con `-RegisterCount` correcto
3. Ajusta `.env` del backend con licencia pública y extras
4. Verifica admin, health check y `/pos`
5. Instala y configura app Electron en cada PC caja (si aplica)
6. Configura POS móvil en tablets (solo URL en navegador)
7. Obtén el request code del cliente
8. Emite licencia desde tu máquina
9. Activa licencia en el cliente
10. Capacita al equipo en admin + caja
11. Guarda copia del JSON emitido y deja acta de entrega
