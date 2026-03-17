[CmdletBinding()]
param(
    [string]$InstallRoot = "",
    [string]$BackupRoot = "",
    [switch]$SkipPipInstall,
    [switch]$SkipSchemaUpgrade,
    [switch]$SkipServiceInstall,
    [switch]$SkipHealthCheck,
    [int]$HealthTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ServiceName = "MiniMarketPOS-Server"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Elevation {
    if (Test-IsAdmin) {
        return
    }

    Write-Host "Re-launching updater with administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    $argumentList = @("-ExecutionPolicy", "Bypass", "-File", "`"$scriptPath`"")
    foreach ($entry in $PSBoundParameters.GetEnumerator()) {
        $name = "-$($entry.Key)"
        if ($entry.Value -is [switch]) {
            if ($entry.Value.IsPresent) {
                $argumentList += $name
            }
            continue
        }

        $argumentList += $name
        $argumentList += "`"$($entry.Value)`""
    }

    Start-Process -FilePath "powershell.exe" -Verb RunAs -WorkingDirectory (Get-Location).Path -ArgumentList $argumentList | Out-Null
    exit 0
}

function Get-SourceRoot {
    return (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
}

function Resolve-AbsolutePath {
    param(
        [string]$PathValue,
        [string]$BasePath
    )

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return ""
    }

    if ([System.IO.Path]::IsPathRooted($PathValue)) {
        return [System.IO.Path]::GetFullPath($PathValue)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $BasePath $PathValue))
}

function Get-PathKey {
    param([string]$PathValue)
    return ([System.IO.Path]::GetFullPath($PathValue)).TrimEnd("\").ToLowerInvariant()
}

function Ensure-Directory {
    param([string]$PathValue)

    if (-not (Test-Path $PathValue)) {
        New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
    }
}

function Copy-PathChecked {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Source)) {
        throw "Required source path not found: $Source"
    }

    $parent = Split-Path -Parent $Destination
    if ($parent) {
        Ensure-Directory -PathValue $parent
    }

    Copy-Item -Path $Source -Destination $Destination -Recurse -Force
}

function Copy-ServerContent {
    param(
        [string]$SourceServerDir,
        [string]$TargetServerDir
    )

    foreach ($directoryName in @("app", "alembic")) {
        $sourcePath = Join-Path $SourceServerDir $directoryName
        $targetPath = Join-Path $TargetServerDir $directoryName
        if (Test-Path $targetPath) {
            Remove-Item -Path $targetPath -Recurse -Force
        }
        Copy-PathChecked -Source $sourcePath -Destination $targetPath
    }

    foreach ($fileName in @(
        ".env.example",
        "alembic.ini",
        "bootstrap.py",
        "install_service.py",
        "license-public.pem",
        "NexoBackendServiceHost.cs",
        "requirements.txt",
        "run.py",
        "seed.py",
        "serve.py"
    )) {
        Copy-PathChecked -Source (Join-Path $SourceServerDir $fileName) -Destination (Join-Path $TargetServerDir $fileName)
    }
}

function Copy-AdminBundle {
    param(
        [string]$SourceAdminDist,
        [string]$TargetAdminDist
    )

    if (Test-Path $TargetAdminDist) {
        Remove-Item -Path $TargetAdminDist -Recurse -Force
    }

    Copy-PathChecked -Source $SourceAdminDist -Destination $TargetAdminDist
}

function Copy-ScriptFiles {
    param(
        [string]$SourceScriptsDir,
        [string]$TargetScriptsDir
    )

    foreach ($fileName in @(
        "install-server.ps1",
        "install-server.cmd",
        "install-server-prebuilt.cmd",
        "update-server.ps1",
        "update-server.cmd"
    )) {
        Copy-PathChecked -Source (Join-Path $SourceScriptsDir $fileName) -Destination (Join-Path $TargetScriptsDir $fileName)
    }
}

function Backup-InstalledFiles {
    param(
        [string]$TargetRoot,
        [string]$BackupDir,
        [bool]$BackupCode
    )

    Ensure-Directory -PathValue $BackupDir

    $targetServerDir = Join-Path $TargetRoot "server-fastapi"
    $targetAdminDist = Join-Path $TargetRoot "admin-web\dist"

    if (Test-Path (Join-Path $targetServerDir ".env")) {
        Copy-PathChecked -Source (Join-Path $targetServerDir ".env") -Destination (Join-Path $BackupDir "server-fastapi\.env")
    }

    if (-not $BackupCode) {
        return
    }

    foreach ($directoryName in @("app", "alembic")) {
        $sourcePath = Join-Path $targetServerDir $directoryName
        if (Test-Path $sourcePath) {
            Copy-PathChecked -Source $sourcePath -Destination (Join-Path $BackupDir "server-fastapi\$directoryName")
        }
    }

    foreach ($fileName in @(
        "alembic.ini",
        "bootstrap.py",
        "install_service.py",
        "license-public.pem",
        "NexoBackendServiceHost.cs",
        "requirements.txt",
        "run.py",
        "seed.py",
        "serve.py"
    )) {
        $sourcePath = Join-Path $targetServerDir $fileName
        if (Test-Path $sourcePath) {
            Copy-PathChecked -Source $sourcePath -Destination (Join-Path $BackupDir "server-fastapi\$fileName")
        }
    }

    if (Test-Path $targetAdminDist) {
        Copy-PathChecked -Source $targetAdminDist -Destination (Join-Path $BackupDir "admin-web\dist")
    }
}

function Test-ServiceInstalled {
    param([string]$Name)

    sc.exe query $Name *> $null
    return $LASTEXITCODE -eq 0
}

function Stop-BackendService {
    param(
        [string]$PythonExe,
        [string]$ServerDir
    )

    if (-not (Test-ServiceInstalled -Name $ServiceName)) {
        Write-Host "Windows service '$ServiceName' is not installed; continuing."
        return
    }

    Push-Location $ServerDir
    try {
        & $PythonExe install_service.py stop
        if ($LASTEXITCODE -ne 0) {
            throw "Could not stop Windows service '$ServiceName'."
        }
    }
    finally {
        Pop-Location
    }
}

function Remove-TransientPythonFiles {
    param([string]$ServerDir)

    Get-ChildItem -Path $ServerDir -Recurse -Force -Directory |
        Where-Object {
            $_.Name -eq "__pycache__" -and $_.FullName -notlike "*\venv\*"
        } |
        Remove-Item -Recurse -Force

    Get-ChildItem -Path $ServerDir -Recurse -Force -File |
        Where-Object {
            $_.Extension -in @(".pyc", ".pyo") -and $_.FullName -notlike "*\venv\*"
        } |
        Remove-Item -Force
}

function Install-Dependencies {
    param(
        [string]$PythonExe,
        [string]$RequirementsFile
    )

    & $PythonExe -m pip install -r $RequirementsFile
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed."
    }
}

function Upgrade-DatabaseSchema {
    param(
        [string]$PythonExe,
        [string]$ServerDir
    )

    Push-Location $ServerDir
    try {
        & $PythonExe -c "import os; from app.core.config import settings; import bootstrap; os.environ['DATABASE_URL'] = settings.DATABASE_URL; bootstrap.ensure_schema_current()"
        if ($LASTEXITCODE -ne 0) {
            throw "Schema upgrade failed."
        }
    }
    finally {
        Pop-Location
    }
}

function Install-BackendService {
    param(
        [string]$PythonExe,
        [string]$ServerDir
    )

    Push-Location $ServerDir
    try {
        & $PythonExe install_service.py install
        if ($LASTEXITCODE -ne 0) {
            throw "Could not install/start Windows service."
        }
    }
    finally {
        Pop-Location
    }
}

function Get-ConfiguredServerPort {
    param(
        [string]$PythonExe,
        [string]$ServerDir
    )

    Push-Location $ServerDir
    try {
        $output = & $PythonExe -c "from app.core.config import settings; print(settings.SERVER_PORT)"
        if ($LASTEXITCODE -ne 0) {
            throw "Could not read SERVER_PORT from .env."
        }
    }
    finally {
        Pop-Location
    }

    return [int](($output | Select-Object -Last 1).Trim())
}

function Wait-ForHealth {
    param(
        [int]$Port,
        [int]$TimeoutSeconds
    )

    $healthUrl = "http://127.0.0.1:$Port/api/health"
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "Health check OK: $healthUrl"
                return
            }
        }
        catch {
        }

        Start-Sleep -Seconds 2
    }

    throw "Health check failed after $TimeoutSeconds seconds: $healthUrl"
}

Ensure-Elevation

$sourceRoot = Get-SourceRoot
$targetRoot = ""
if ([string]::IsNullOrWhiteSpace($InstallRoot)) {
    $inPlaceEnv = Join-Path $sourceRoot "server-fastapi\.env"
    if (-not (Test-Path $inPlaceEnv)) {
        throw "InstallRoot is required when running from a delivery package that does not contain the active .env."
    }
    $targetRoot = $sourceRoot
}
else {
    $targetRoot = Resolve-AbsolutePath -PathValue $InstallRoot -BasePath (Get-Location).Path
}

$sourceServerDir = Join-Path $sourceRoot "server-fastapi"
$sourceAdminDist = Join-Path $sourceRoot "admin-web\dist"
$sourceScriptsDir = Join-Path $sourceRoot "scripts\windows"
$targetServerDir = Join-Path $targetRoot "server-fastapi"
$targetAdminDist = Join-Path $targetRoot "admin-web\dist"
$targetScriptsDir = Join-Path $targetRoot "scripts\windows"
$targetVenvPython = Join-Path $targetServerDir "venv\Scripts\python.exe"
$isInPlaceUpdate = (Get-PathKey -PathValue $sourceRoot) -eq (Get-PathKey -PathValue $targetRoot)

Write-Step "Validating source package"
foreach ($requiredPath in @(
    $sourceServerDir,
    $sourceAdminDist,
    (Join-Path $sourceServerDir "install_service.py"),
    (Join-Path $sourceServerDir "requirements.txt")
)) {
    if (-not (Test-Path $requiredPath)) {
        throw "Required source path not found: $requiredPath"
    }
}

Write-Step "Validating target installation"
foreach ($requiredPath in @(
    $targetRoot,
    $targetServerDir,
    (Join-Path $targetServerDir ".env"),
    $targetVenvPython
)) {
    if (-not (Test-Path $requiredPath)) {
        throw "Required target path not found: $requiredPath"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
    $backupDir = Join-Path $targetServerDir "backups\update-$timestamp"
}
else {
    $backupDir = Resolve-AbsolutePath -PathValue $BackupRoot -BasePath $targetRoot
}

Write-Step "Creating backup"
Backup-InstalledFiles -TargetRoot $targetRoot -BackupDir $backupDir -BackupCode:(-not $isInPlaceUpdate)
Write-Host "Backup created in: $backupDir"

Write-Step "Stopping backend service"
Stop-BackendService -PythonExe $targetVenvPython -ServerDir $targetServerDir

if (-not $isInPlaceUpdate) {
    Write-Step "Copying new backend and admin files"
    Copy-ServerContent -SourceServerDir $sourceServerDir -TargetServerDir $targetServerDir
    Copy-AdminBundle -SourceAdminDist $sourceAdminDist -TargetAdminDist $targetAdminDist
    Copy-ScriptFiles -SourceScriptsDir $sourceScriptsDir -TargetScriptsDir $targetScriptsDir
    Remove-TransientPythonFiles -ServerDir $targetServerDir
}
else {
    Write-Host "Source and target are the same folder; skipping file copy."
}

if (-not $SkipPipInstall.IsPresent) {
    Write-Step "Installing backend dependencies"
    Install-Dependencies -PythonExe $targetVenvPython -RequirementsFile (Join-Path $targetServerDir "requirements.txt")
}
else {
    Write-Host "Skipping pip install by request."
}

if (-not $SkipSchemaUpgrade.IsPresent) {
    Write-Step "Upgrading database schema"
    Upgrade-DatabaseSchema -PythonExe $targetVenvPython -ServerDir $targetServerDir
}
else {
    Write-Host "Skipping schema upgrade by request."
}

if (-not $SkipServiceInstall.IsPresent) {
    Write-Step "Reinstalling backend Windows service"
    Install-BackendService -PythonExe $targetVenvPython -ServerDir $targetServerDir
}
else {
    Write-Warning "Skipping service install by request. The backend service remains stopped until you start it manually."
}

if ((-not $SkipHealthCheck.IsPresent) -and (-not $SkipServiceInstall.IsPresent)) {
    Write-Step "Checking backend health endpoint"
    $serverPort = Get-ConfiguredServerPort -PythonExe $targetVenvPython -ServerDir $targetServerDir
    Wait-ForHealth -Port $serverPort -TimeoutSeconds $HealthTimeoutSeconds
}
elseif ($SkipHealthCheck.IsPresent) {
    Write-Host "Skipping health check by request."
}

Write-Host ""
Write-Host "Server update completed." -ForegroundColor Green
Write-Host "Install root: $targetRoot"
Write-Host "Backup: $backupDir"
if (-not $SkipServiceInstall.IsPresent) {
    Write-Host "Service: $ServiceName"
}
