# Deploy

Esta carpeta es para preparar entregas limpias para clientes, sin arrastrar el repo completo ni secretos.

## Como generar un paquete de entrega

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\prepare-delivery.ps1 -CustomerName "Don Pedro"
```

Opcional:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\prepare-delivery.ps1 -CustomerName "Don Pedro" -IncludeSyncWorker
```

## Resultado

El script crea una carpeta nueva en `deploy/output/<cliente>-<fecha>/` con:

- `servidor/`: lo que si puedes copiar al PC servidor del cliente
- `cajas/`: el instalador que si puedes usar en cada caja
- `updates/`: binarios compilados para subir como assets de tu GitHub Release

## Que queda fuera

El paquete generado excluye a proposito:

- `.git`
- `.github`
- `secrets/`
- `licenses/`
- `server-fastapi/.env`
- `server-fastapi/venv`
- `server-fastapi/test_materials`
- `node_modules`
- codigo fuente del cliente Electron

## Nota

`server-fastapi/license-public.pem` si se incluye, porque el servidor del cliente la necesita para validar licencias.
