# Guia Personal del Vendedor: instalacion completa y licencias de Nexo

Esta guia esta pensada para ti como vendedor/implementador. El objetivo es que puedas:

1. Preparar tu kit comercial una sola vez.
2. Instalar el sistema completo desde cero en un cliente.
3. Dejar operativas una o varias cajas.
4. Emitir y activar licencias offline sin exponer tu clave privada.

Los ejemplos asumen Windows 10/11 y una carpeta de trabajo como `C:\Nexo\minimarket-pos`, pero el proyecto puede vivir en otra ruta.

## 1. Que compone el sistema

El sistema tiene 4 piezas:

- `server-fastapi/`: backend FastAPI + PostgreSQL. Va en el PC servidor del cliente.
- `admin-web/`: panel web de administracion. Queda servido por el backend en `/admin`.
- `client-electron-pos/`: app de caja para cada puesto de venta.
- `sync-worker/`: backup cloud opcional con Supabase.

Arquitectura recomendada:

- 1 PC servidor con backend + base de datos PostgreSQL.
- 1 o mas PCs de caja con la app Electron.
- Red LAN estable entre cajas y servidor.

## 2. Lo que debes preparar una sola vez como vendedor

### 2.1. Generar tu sistema de licencias

Haz esto una sola vez en tu maquina de trabajo:

```powershell
python scripts/generate_license_keypair.py --private-out secrets/license-private.pem --public-out server-fastapi/license-public.pem
```

Resultado:

- `secrets/license-private.pem`: es tu clave privada. Nunca se entrega al cliente.
- `server-fastapi/license-public.pem`: es la clave publica que si debe ir en cada servidor cliente.

Regla comercial:

- Usa la misma clave privada para todos tus clientes de esta linea de producto.
- Respaldala en 2 lugares seguros.
- No la copies al PC del cliente.

### 2.2. Preparar el panel admin para produccion

Antes de compilar `admin-web`, revisa `admin-web/.env`.

Configuracion recomendada para produccion:

```env
VITE_USE_MOCKS=false
```

Recomendacion importante:

- Si vas a abrir el panel admin desde otras PCs por LAN, no dejes `VITE_API_URL=http://localhost:8000` al compilar.
- Lo mas seguro es dejar `VITE_API_URL` sin definir para que el panel use el mismo origen del servidor.

Si compilas el panel con `localhost`, el admin web funcionara bien en el PC servidor, pero puede fallar cuando se abra desde otra maquina.

### 2.3. Compilar el instalador de caja

En tu maquina de trabajo:

```powershell
cd client-electron-pos
npm install
npm run electron:build
```

Archivo resultante:

- `client-electron-pos/dist-electron/Nexo-Setup-<version>.exe`

Ese `.exe` es el que instalas en cada caja. La caja no necesita Node.js si ya llevas el instalador compilado.

### 2.4. Tener listo tu repo maestro

Tu carpeta maestra deberia incluir:

- el proyecto completo
- `server-fastapi/venv/` creado en tu maquina de trabajo
- `server-fastapi/license-public.pem`
- `secrets/license-private.pem` solo en tu maquina
- el instalador `Nexo-Setup-<version>.exe`
- una carpeta `licenses/` para ir guardando licencias emitidas

Nota:

- `issue-license-menu.bat` usa `server-fastapi\venv\Scripts\python.exe`.
- Si esa `venv` no existe en tu maquina, primero crea el entorno del backend una vez.

### 2.5. Carpeta comercial recomendada

```text
Nexo-Ventas/
  repo-maestro/
  instaladores/
    Nexo-Setup-1.0.9.exe
  secretos/
    license-private.pem
  clientes/
    Don-Pedro/
      notas-instalacion.txt
      request-code.txt
      licencia-emitida.json
      datos-comerciales.txt
```

## 3. Datos y archivos que debes pedir/reunir por cliente

Antes de instalar, junta esto:

- nombre comercial del local
- RUT del negocio
- direccion
- cantidad de cajas vendidas
- PIN administrador
- PIN de cajero inicial
- correo y telefono de contacto
- si quiere SII: certificado `.pfx`, password del certificado y CAF XML real
- si quiere backup cloud: `SUPABASE_URL` y `SUPABASE_KEY`

Hardware minimo recomendado:

- 1 PC servidor Windows 10/11
- red LAN estable
- 1 impresora termica por caja si va a imprimir
- lector de codigo de barras USB opcional

## 4. Que archivos necesita cada instalacion

### 4.1. En el PC servidor del cliente

Necesitas tener/copiar:

- el proyecto completo
- `server-fastapi/license-public.pem`
- opcionalmente materiales reales SII: `.pfx` y CAF XML

### 4.2. En cada PC caja

Necesitas tener:

- `Nexo-Setup-<version>.exe`
- driver de impresora termica si aplica

### 4.3. Archivos que NO van al cliente

Nunca copies al cliente:

- `secrets/license-private.pem`
- respaldos internos con otras licencias
- tus claves comerciales o repositorio privado si no corresponde

## 5. Instalacion recomendada del servidor desde cero

La forma mas conveniente es usar el instalador automatico de Windows.

### 5.1. Requisitos

- correr PowerShell como administrador
- tener internet para `winget`
- si PostgreSQL ya estaba instalado, debes saber la clave del superusuario `postgres`

### 5.2. Comando recomendado

Ejemplo para un cliente con 2 cajas:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-server.ps1 `
  -StoreName "Almacen Don Pedro" `
  -StoreRut "76.123.456-7" `
  -StoreAddress "Av. Principal 123, Santiago" `
  -AdminPin "2580" `
  -CashierPin "1590" `
  -RegisterCount 2 `
  -DatabaseName "minimarket_pos" `
  -DatabaseUser "minimarket_pos" `
  -DatabasePassword "Cambia-Esta-Clave-2026"
```

Si PostgreSQL ya existe en ese PC:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-server.ps1 `
  -StoreName "Almacen Don Pedro" `
  -StoreRut "76.123.456-7" `
  -StoreAddress "Av. Principal 123, Santiago" `
  -AdminPin "2580" `
  -CashierPin "1590" `
  -RegisterCount 2 `
  -DatabaseName "minimarket_pos" `
  -DatabaseUser "minimarket_pos" `
  -DatabasePassword "Cambia-Esta-Clave-2026" `
  -PostgresSuperPassword "CLAVE-POSTGRES"
```

Que hace este script:

- eleva permisos
- instala Python si falta
- instala Node.js si falta
- instala PostgreSQL si falta
- crea base de datos y usuario
- crea `server-fastapi/.env`
- crea `venv` e instala dependencias del backend
- compila `admin-web`
- inicializa tablas y datos base
- abre en firewall el puerto indicado en `-ServerPort` (por defecto `8000`)
- instala el servicio Windows `MiniMarketPOS-Server`
- deja el panel admin servido por el mismo backend en `/admin`

Si el puerto `8000` ya esta ocupado, por ejemplo por Docker, puedes instalar Nexo en otro puerto:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-server.ps1 `
  -StoreName "Almacen Don Pedro" `
  -StoreRut "76.123.456-7" `
  -StoreAddress "Av. Principal 123, Santiago" `
  -AdminPin "2580" `
  -CashierPin "1590" `
  -RegisterCount 2 `
  -DatabaseName "minimarket_pos" `
  -DatabaseUser "minimarket_pos" `
  -DatabasePassword "Cambia-Esta-Clave-2026" `
  -ServerPort 8001
```

### 5.3. Parametros comerciales que debes ajustar siempre

No dejes los defaults sin revisar:

- `-RegisterCount`: debe coincidir con las cajas vendidas.
- `-AdminPin`: no dejes `1234` en cliente real.
- `-CashierPin`: no dejes `0000` en cliente real.
- `-StoreName`, `-StoreRut`, `-StoreAddress`: pon los datos reales.
- `-ServerPort`: usa `8001` u otro puerto libre si `8000` ya esta tomado.

Si quieres productos demo para capacitacion:

```powershell
... -WithDemoData
```

Si es un cliente real que ya va a operar, mejor no cargar demo a menos que luego limpies esos datos.

### 5.4. Instalacion manual si `winget` falla o no hay internet

Usa esta ruta si el instalador automatico no puede instalar dependencias.

1. Instala manualmente en el PC servidor:
   - Python 3.11+
   - PostgreSQL 15+
   - Node.js 20+
2. Crea la base de datos y usuario en PostgreSQL:

```sql
CREATE USER minimarket_pos WITH PASSWORD 'Cambia-Esta-Clave-2026';
CREATE DATABASE minimarket_pos OWNER minimarket_pos;
```

3. Crea la `venv` del backend e instala dependencias:

```powershell
cd server-fastapi
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

4. Inicializa configuracion, tablas y usuarios base:

```powershell
cd server-fastapi
venv\Scripts\python.exe bootstrap.py `
  --database-url "postgresql://minimarket_pos:Cambia-Esta-Clave-2026@localhost:5432/minimarket_pos" `
  --server-port 8000 `
  --store-name "Almacen Don Pedro" `
  --store-rut "76.123.456-7" `
  --store-address "Av. Principal 123, Santiago" `
  --admin-pin "2580" `
  --cashier-pin "1590" `
  --register-count 2 `
  --overwrite-env
```

5. Compila el panel admin:

```powershell
cd admin-web
npm install
npm run build
```

6. Deja el backend con arranque automatico:

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py install
```

Ese servicio Windows tambien deja disponible el panel admin en `http://localhost:<puerto>/admin`.
No se instala un proceso aparte para admin web.

Comandos utiles del servicio:

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py status
venv\Scripts\python.exe install_service.py restart
venv\Scripts\python.exe install_service.py stop
venv\Scripts\python.exe install_service.py uninstall
```

Log del host Windows:

- `server-fastapi/logs/windows-service-host.log`

7. Luego continua con la seccion 6 de esta guia para ajustar licencias, SII y extras.

## 6. Ajustes obligatorios despues de instalar el servidor

El instalador automatico NO deja lista la parte comercial de licencias. Debes revisar `server-fastapi/.env`.

Agrega o valida estas lineas:

```env
LICENSE_PUBLIC_KEY_PATH=C:/Nexo/minimarket-pos/server-fastapi/license-public.pem
LICENSE_TRIAL_DAYS=30
LICENSE_CLOCK_SKEW_MINUTES=90
```

Si el proyecto quedo en otra carpeta, cambia la ruta absoluta.

Si el cliente contratara backup cloud:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_KEY=tu-clave
```

Si el cliente contratara boleta electronica SII:

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

Importante:

- No uses `server-fastapi/test_materials/*` en produccion.
- Esos archivos sirven para pruebas locales, no para SII real.

Despues de editar `.env`, reinicia el backend:

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py restart
```

## 7. Verificacion del servidor

Comprueba esto antes de instalar cajas:

- API: `http://localhost:<puerto>/api/health`
- Panel admin: `http://localhost:<puerto>/admin`
- En red LAN: `http://IP_DEL_SERVIDOR:<puerto>/admin`

`<puerto>` es el que definiste en `-ServerPort`. Si no cambiaste nada, sera `8000`.

Credenciales iniciales:

- login real: por PIN
- usuario interno admin: `admin`
- PIN admin: el que definiste en la instalacion
- usuario interno cajero base: `cajero1`
- PIN cajero: el que definiste en la instalacion

## 8. Instalacion de cada caja

En cada PC caja:

1. Instala `Nexo-Setup-<version>.exe`.
2. Abre Nexo.
3. En la pantalla de login, pulsa `Configurar servidor`.
4. Ingresa `http://IP_DEL_SERVIDOR:<puerto>`.
5. Inicia sesion con PIN de admin o cajero.
6. Selecciona la caja correspondiente.
7. En `Configuracion`, elige la impresora termica.
8. Haz una venta de prueba e imprime un ticket.

Notas importantes:

- El cliente POS guarda la URL del servidor en localStorage.
- Si no cambias la URL, por defecto intentara usar `http://localhost:8000`.
- Cada caja debe apuntar al PC servidor del cliente, no a tu notebook.
- Si moviste el backend a `8001`, recuerda usar ese mismo puerto en admin y en cada caja.

## 9. Flujo correcto para vender licencias offline

La licencia se genera en el servidor del cliente y se emite desde tu maquina.

### 9.1. Paso 1: obtener el request code del cliente

Opciones:

- en `Admin > Configuracion > Licencia Offline`
- o en la app POS, entrando como admin a `Configuracion`

Copia:

- el `request_code`
- o el JSON de solicitud

### 9.2. Paso 2: emitir la licencia en tu maquina

Opcion facil con menu:

```powershell
.\issue-license-menu.bat
```

El menu te pedira:

- nombre del cliente
- request code o archivo request
- tipo de licencia
- cantidad de cajas
- fecha de expiracion si aplica
- fecha de updates si aplica
- features opcionales

El resultado se guarda por defecto en `licenses/` y ademas se copia al portapapeles.

Opcion por comando:

```powershell
python scripts/issue_license.py `
  --private-key secrets/license-private.pem `
  --request-code "<codigo>" `
  --customer "Almacen Don Pedro" `
  --max-registers 2 `
  --updates-until 2027-03-13T23:59:59Z `
  --out licenses/don-pedro.json
```

Ejemplos utiles:

- licencia perpetua: usa `--license-type perpetual`
- licencia anual: usa `--duration-days 365`
- demo 30 dias: usa `--duration-days 30`
- expiracion exacta: usa `--expires-at 2027-12-31T23:59:59Z`
- modulos: repite `--feature sii` o `--feature backup`

### 9.3. Paso 3: activar la licencia en el cliente

En el panel de licencia del cliente:

1. pega el JSON firmado
2. pulsa `Activar licencia`
3. verifica que el estado pase a `licensed`

### 9.4. Regla de oro

- La licencia queda atada a `installation_id` + `hardware_hash` del servidor.
- Si cambias el PC servidor, reinstalas Windows o clonas la instalacion a otra maquina, debes sacar un request code nuevo y reemitir la licencia.

## 10. Como vender tipos de licencia

Sugerencia practica:

- plan 1 caja: instala con `-RegisterCount 1` y emite licencia con `--max-registers 1`
- plan 2 cajas: instala con `-RegisterCount 2` y emite licencia con `--max-registers 2`
- plan 3 cajas: instala con `-RegisterCount 3` y emite licencia con `--max-registers 3`
- plan anual: `--duration-days 365`
- plan perpetuo: sin `expires_at`, pero puedes dejar `updates_until` por 12 meses

Cuando un cliente compra una caja extra:

1. emite una nueva licencia con mas `max-registers`
2. activa la nueva licencia en el servidor
3. crea la nueva caja y luego instala el POS en ese equipo

## 11. Que debes guardar tu como vendedor

Por cada cliente guarda:

- nombre del cliente
- cantidad de cajas vendidas
- PIN admin entregado
- request code o request JSON
- licencia emitida final
- fecha de venta
- fecha de expiracion si no es perpetua
- fecha de `updates_until`
- notas de hardware del servidor

Archivo minimo a conservar:

- `licenses/<cliente>.json`

Si el cliente pierde su licencia, puedes reactivarla rapido si mantienes ese archivo.

## 12. Modulos opcionales

### 12.1. Backup cloud con Supabase

Configura en `server-fastapi/.env`:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
```

Luego:

```powershell
cd sync-worker
pip install -r requirements.txt
python sync.py
```

El worker sincroniza cada 30 minutos.

### 12.2. Boleta electronica SII

Para vender este modulo necesitas:

- certificado digital real `.pfx`
- password del certificado
- CAF XML real tipo 39
- datos completos del emisor

No prometas SII productivo usando los archivos de `test_materials/`.

## 13. Advertencias comerciales importantes del sistema actual

Estas notas son importantes para no vender algo que hoy el sistema no hace automaticamente.

### 13.1. `updates_until` hoy es informativo

La fecha `updates_until` queda guardada y visible, pero hoy no bloquea automaticamente el uso del sistema ni las actualizaciones por si sola.

### 13.2. El limite de cajas debes ordenarlo desde la instalacion

El sistema valida el limite al crear nuevas cajas, pero no desactiva automaticamente cajas que ya existan.

Por eso:

- instala desde el inicio con `-RegisterCount` igual al plan vendido
- no dejes 3 cajas creadas si vendiste 1

### 13.3. Los datos de tienda debes dejarlos en `.env`

El panel admin permite editar nombre/RUT/direccion, pero para dejarlo persistente tras reinicios debes revisar `server-fastapi/.env`.

### 13.4. Auto-update del cliente apunta al repo configurado

El cliente Electron usa `electron-updater` y el `publish` actual apunta a GitHub.

Antes de vender auto-actualizaciones en serio, revisa `client-electron-pos/package.json`:

- `build.publish.owner`
- `build.publish.repo`

Si no lo ajustas, la app buscara releases en ese repositorio configurado.

## 14. Checklist final de entrega al cliente

Antes de cerrar la instalacion verifica:

- backend responde en `http://IP_DEL_SERVIDOR:<puerto>/api/health`
- panel admin abre en `http://IP_DEL_SERVIDOR:<puerto>/admin`
- licencia activada y estado `licensed`
- cantidad de cajas creada coincide con lo vendido
- cada caja apunta al servidor correcto
- cada caja imprime ticket de prueba
- admin puede entrar al panel
- cajero puede abrir y cerrar caja
- hora y fecha del servidor estan correctas
- `.env` tiene configurada la ruta de `LICENSE_PUBLIC_KEY_PATH`
- guardaste una copia de la licencia emitida

## 15. Comandos rapidos de uso diario

Emitir licencia con menu:

```powershell
.\issue-license-menu.bat
```

Reiniciar backend:

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py restart
```

Ver estado del servicio Windows:

```powershell
cd server-fastapi
venv\Scripts\python.exe install_service.py status
```

Compilar instalador de caja:

```powershell
cd client-electron-pos
npm run electron:build
```

## 16. Flujo recomendado para cada nueva venta

1. Define cuantas cajas venderas.
2. Instala servidor con `RegisterCount` correcto.
3. Ajusta `.env` del backend con clave publica y extras.
4. Verifica admin y health check.
5. Instala la app en cada caja.
6. Configura URL del servidor e impresora.
7. Obtiene el request code del cliente.
8. Emite licencia desde tu maquina.
9. Activa licencia.
10. Guarda copia del JSON emitido y deja acta de entrega.
