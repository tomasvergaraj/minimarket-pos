[CmdletBinding()]
param(
    [string]$CustomerName = "plantilla",
    [string]$OutputDir = "",
    [switch]$IncludeSyncWorker
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function ConvertTo-Slug {
    param([Parameter(Mandatory = $true)][string]$Value)

    $normalized = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
    $normalized = $normalized.Trim("-")
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return "cliente"
    }
    return $normalized
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$PathValue)

    if (-not (Test-Path $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
    }
}

function Copy-PathChecked {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    if (-not (Test-Path $Source)) {
        throw "No se encontro la ruta requerida: $Source"
    }

    $parent = Split-Path -Parent $Destination
    if ($parent) {
        Ensure-Directory -PathValue $parent
    }

    Copy-Item -Path $Source -Destination $Destination -Recurse -Force
}

function Write-Utf8File {
    param(
        [Parameter(Mandatory = $true)][string]$PathValue,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $PathValue
    if ($parent) {
        Ensure-Directory -PathValue $parent
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PathValue, $Content.TrimStart() + [Environment]::NewLine, $utf8NoBom)
}

function Remove-NoiseFiles {
    param([Parameter(Mandatory = $true)][string]$RootPath)

    if (-not (Test-Path $RootPath)) {
        return
    }

    Get-ChildItem -Path $RootPath -Recurse -Directory -Force |
        Where-Object { $_.Name -eq "__pycache__" } |
        Remove-Item -Recurse -Force

    Get-ChildItem -Path $RootPath -Recurse -File -Force |
        Where-Object { $_.Extension -in @(".pyc", ".pyo") } |
        Remove-Item -Force
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$clientDistDir = Join-Path $repoRoot "client-electron-pos\dist-electron"
$adminDistDir = Join-Path $repoRoot "admin-web\dist"
$serverDir = Join-Path $repoRoot "server-fastapi"
$syncWorkerDir = Join-Path $repoRoot "sync-worker"

if (-not (Test-Path $clientDistDir)) {
    throw "No existe client-electron-pos\dist-electron. Compila primero el cliente."
}

if (-not (Test-Path $adminDistDir)) {
    throw "No existe admin-web\dist. Compila primero el panel admin."
}

$installer = Get-ChildItem -Path $clientDistDir -File |
    Where-Object { $_.Name -like "Nexo-Setup-*.exe" -or $_.Name -like "MiniMarket-POS-Setup-*.exe" } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $installer) {
    throw "No se encontro un instalador .exe compilado en client-electron-pos\dist-electron."
}

$installerBlockmap = Get-ChildItem -Path $clientDistDir -File |
    Where-Object { $_.Name -eq "$($installer.Name).blockmap" } |
    Select-Object -First 1

$latestYml = Join-Path $clientDistDir "latest.yml"
if (-not (Test-Path $latestYml)) {
    throw "No se encontro latest.yml en client-electron-pos\dist-electron."
}

$slug = ConvertTo-Slug -Value $CustomerName
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $outputRoot = Join-Path $repoRoot "deploy\output\$slug-$timestamp"
}
else {
    if ([System.IO.Path]::IsPathRooted($OutputDir)) {
        $outputRoot = $OutputDir
    }
    else {
        $outputRoot = Join-Path $repoRoot $OutputDir
    }
}

if (Test-Path $outputRoot) {
    throw "La carpeta de salida ya existe: $outputRoot"
}

$serverOutput = Join-Path $outputRoot "servidor"
$cashierOutput = Join-Path $outputRoot "cajas"
$updatesOutput = Join-Path $outputRoot "updates"

Ensure-Directory -PathValue $serverOutput
Ensure-Directory -PathValue $cashierOutput
Ensure-Directory -PathValue $updatesOutput

$serverFiles = @(
    ".env.example",
    "alembic.ini",
    "NexoBackendServiceHost.cs",
    "bootstrap.py",
    "install_service.py",
    "license-public.pem",
    "requirements.txt",
    "run.py",
    "seed.py",
    "serve.py"
)

$serverDirs = @(
    "app",
    "alembic"
)

foreach ($dirName in $serverDirs) {
    Copy-PathChecked -Source (Join-Path $serverDir $dirName) -Destination (Join-Path $serverOutput "server-fastapi\$dirName")
}

foreach ($fileName in $serverFiles) {
    Copy-PathChecked -Source (Join-Path $serverDir $fileName) -Destination (Join-Path $serverOutput "server-fastapi\$fileName")
}

Copy-PathChecked -Source $adminDistDir -Destination (Join-Path $serverOutput "admin-web\dist")
Copy-PathChecked -Source (Join-Path $repoRoot "scripts\windows\install-server.ps1") -Destination (Join-Path $serverOutput "scripts\windows\install-server.ps1")
Copy-PathChecked -Source (Join-Path $repoRoot "scripts\windows\install-server.cmd") -Destination (Join-Path $serverOutput "scripts\windows\install-server.cmd")
Copy-PathChecked -Source (Join-Path $repoRoot "scripts\windows\install-server-prebuilt.cmd") -Destination (Join-Path $serverOutput "scripts\windows\install-server-prebuilt.cmd")

if ($IncludeSyncWorker.IsPresent) {
    Copy-PathChecked -Source (Join-Path $syncWorkerDir "sync.py") -Destination (Join-Path $serverOutput "sync-worker\sync.py")
    Copy-PathChecked -Source (Join-Path $syncWorkerDir "requirements.txt") -Destination (Join-Path $serverOutput "sync-worker\requirements.txt")
}

Remove-NoiseFiles -RootPath $serverOutput

Copy-PathChecked -Source $installer.FullName -Destination (Join-Path $cashierOutput $installer.Name)

Copy-PathChecked -Source $installer.FullName -Destination (Join-Path $updatesOutput $installer.Name)
Copy-PathChecked -Source $latestYml -Destination (Join-Path $updatesOutput "latest.yml")
if ($installerBlockmap) {
    Copy-PathChecked -Source $installerBlockmap.FullName -Destination (Join-Path $updatesOutput $installerBlockmap.Name)
}

$syncNote = if ($IncludeSyncWorker.IsPresent) {
    "- `sync-worker/` ya va incluido en este paquete."
}
else {
    "- `sync-worker/` no se incluyo. Vuelve a generar el paquete con `-IncludeSyncWorker` si vendiste backup cloud."
}

Write-Utf8File -PathValue (Join-Path $outputRoot "INSTRUCCIONES-ENTREGA.txt") -Content @"
PAQUETE DE ENTREGA NEXO

Cliente/alias: $CustomerName
Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Carpetas:
- servidor/: copiar completa al PC servidor del cliente
- cajas/: usar el instalador .exe en cada PC caja
- updates/: subir estos binarios como assets de tu GitHub Release si usaras auto-update

Importante:
- Este paquete NO incluye secretos ni tu clave privada de licencias.
- `server-fastapi/license-public.pem` si va incluido porque el servidor del cliente la necesita.
- No copies al cliente tu carpeta `secrets/` ni `licenses/`.
- Despues de instalar el servidor, revisa `server-fastapi/.env` y configura `LICENSE_PUBLIC_KEY_PATH`.

$syncNote
"@

Write-Utf8File -PathValue (Join-Path $serverOutput "README-SERVIDOR.txt") -Content @"
ENTREGA AL PC SERVIDOR

Esta carpeta si puede copiarse al PC servidor del cliente.

Contenido:
- `server-fastapi/`
- `admin-web/dist`
- `scripts/windows/install-server.cmd`
- `scripts/windows/install-server-prebuilt.cmd`

Instalacion recomendada:

1. Copia esta carpeta completa al PC servidor.
2. Abre PowerShell o CMD como administrador.
3. Ejecuta:

   scripts\windows\install-server-prebuilt.cmd -StoreName "Nombre Local" -StoreRut "76.123.456-7" -StoreAddress "Direccion" -AdminPin "2580" -CashierPin "1590" -RegisterCount 2

Notas:
- `install-server-prebuilt.cmd` agrega `-SkipAdminBuild`, por lo que usa el admin web ya compilado y evita instalar Node.js.
- Si PostgreSQL ya estaba instalado, agrega `-PostgresSuperPassword "TU_CLAVE"`.
- Despues de instalar, ajusta `server-fastapi/.env` para licencias, SII y modulos opcionales.
- `server-fastapi/.env` NO viene prellenado a proposito.
"@

Write-Utf8File -PathValue (Join-Path $serverOutput "OPCIONAL-SII.txt") -Content @"
ARCHIVOS SII QUE SI PUEDES COPIAR AL CLIENTE SI VENDISTE ESE MODULO

- certificado digital real `.pfx`
- clave del `.pfx`
- CAF XML real tipo 39

No uses `server-fastapi/test_materials` en produccion.
"@

Write-Utf8File -PathValue (Join-Path $cashierOutput "README-CAJAS.txt") -Content @"
ENTREGA A CADA PC CAJA

Archivo a usar:
- $($installer.Name)

Pasos:
1. Ejecuta el instalador en cada caja.
2. Abre Nexo.
3. En login, pulsa `Configurar servidor`.
4. Ingresa `http://IP_DEL_SERVIDOR:8000`.
5. Entra con PIN y configura impresora si aplica.

No copies el repo completo a las cajas.
"@

Write-Utf8File -PathValue (Join-Path $updatesOutput "README-UPDATES.txt") -Content @"
HOSTING DE UPDATES

Esta carpeta no es para el PC del cliente.
Es para subir binarios como assets de tu GitHub Release si usas auto-update.

Sube estos archivos a la release:
- latest.yml
- instalador .exe
- blockmap si existe

El instalador aqui y el de `cajas/` son el mismo binario.
"@

Write-Host ""
Write-Host "Paquete deploy creado:" -ForegroundColor Green
Write-Host "  $outputRoot"
Write-Host ""
Write-Host "Contenido:" -ForegroundColor Cyan
Write-Host "  servidor\"
Write-Host "  cajas\"
Write-Host "  updates\"
