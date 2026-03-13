[CmdletBinding(DefaultParameterSetName = "RequestFile")]
param(
    [Parameter(Mandatory = $true, ParameterSetName = "RequestFile")]
    [string]$RequestFile,

    [Parameter(Mandatory = $true, ParameterSetName = "RequestCode")]
    [string]$RequestCode,

    [Parameter(Mandatory = $true)]
    [string]$Customer,

    [ValidateSet("perpetual", "annual", "demo30", "custom")]
    [string]$Mode = "perpetual",

    [int]$MaxRegisters = 0,
    [string]$UpdatesUntil,
    [int]$DurationDays = 0,
    [string]$ExpiresAt,
    [string[]]$Feature = @(),
    [string]$LicenseType,
    [string]$LicenseId,
    [string]$PrivateKey,
    [string]$Out
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Normalize-InputText {
    param([AllowEmptyString()][string]$Value)

    if ($null -eq $Value) {
        return ""
    }

    $normalized = $Value.Trim()
    if ($normalized.Length -ge 2 -and $normalized.StartsWith('"') -and $normalized.EndsWith('"')) {
        $normalized = $normalized.Substring(1, $normalized.Length - 2)
    }

    return $normalized
}

function ConvertTo-Slug {
    param([Parameter(Mandatory = $true)][string]$Value)

    $normalized = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
    $normalized = $normalized.Trim("-")

    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return "license"
    }

    return $normalized
}

function Resolve-ExistingPath {
    param(
        [Parameter(Mandatory = $true)][string]$PathValue,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $cleanPath = Normalize-InputText -Value $PathValue
    $candidates = @()
    if ([System.IO.Path]::IsPathRooted($cleanPath)) {
        $candidates += $cleanPath
    }
    else {
        $candidates += $cleanPath
        $candidates += (Join-Path $script:RepoRoot $cleanPath)
    }

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return (Resolve-Path $candidate).Path
        }
    }

    throw "$Label no existe: $PathValue"
}

function Resolve-OutputPath {
    param([Parameter(Mandatory = $true)][string]$PathValue)

    $cleanPath = Normalize-InputText -Value $PathValue

    if ([System.IO.Path]::IsPathRooted($cleanPath)) {
        return $cleanPath
    }

    return (Join-Path $script:RepoRoot $cleanPath)
}

$python = Join-Path $script:RepoRoot "server-fastapi\venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    throw "No se encontro Python del backend en: $python"
}

if ([string]::IsNullOrWhiteSpace($PrivateKey)) {
    $PrivateKey = "secrets\license-private.pem"
}
$resolvedPrivateKey = Resolve-ExistingPath -PathValue $PrivateKey -Label "La clave privada"

$now = [DateTimeOffset]::UtcNow

switch ($Mode) {
    "perpetual" {
        if ([string]::IsNullOrWhiteSpace($LicenseType)) {
            $LicenseType = "perpetual"
        }
        if ([string]::IsNullOrWhiteSpace($UpdatesUntil)) {
            $UpdatesUntil = $now.AddYears(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
        }
        if ($MaxRegisters -le 0) {
            $MaxRegisters = 3
        }
    }
    "annual" {
        if ([string]::IsNullOrWhiteSpace($LicenseType)) {
            $LicenseType = "annual"
        }
        if ($DurationDays -le 0 -and [string]::IsNullOrWhiteSpace($ExpiresAt)) {
            $DurationDays = 365
        }
        if ([string]::IsNullOrWhiteSpace($UpdatesUntil)) {
            if ([string]::IsNullOrWhiteSpace($ExpiresAt)) {
                $UpdatesUntil = $now.AddDays($DurationDays).ToString("yyyy-MM-ddTHH:mm:ssZ")
            }
            else {
                $UpdatesUntil = $ExpiresAt
            }
        }
        if ($MaxRegisters -le 0) {
            $MaxRegisters = 3
        }
    }
    "demo30" {
        if ([string]::IsNullOrWhiteSpace($LicenseType)) {
            $LicenseType = "demo"
        }
        if ($DurationDays -le 0 -and [string]::IsNullOrWhiteSpace($ExpiresAt)) {
            $DurationDays = 30
        }
        if ($MaxRegisters -le 0) {
            $MaxRegisters = 1
        }
    }
    "custom" {
        if ([string]::IsNullOrWhiteSpace($LicenseType)) {
            $LicenseType = "custom"
        }
        if ($MaxRegisters -le 0) {
            $MaxRegisters = 3
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Out)) {
    $licensesDir = Join-Path $script:RepoRoot "licenses"
    $slug = ConvertTo-Slug -Value $Customer
    $Out = Join-Path $licensesDir "$slug-$Mode.json"
}

$resolvedOut = Resolve-OutputPath -PathValue $Out
$outDir = Split-Path -Parent $resolvedOut
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$pythonArgs = @(
    (Join-Path $script:RepoRoot "scripts\issue_license.py"),
    "--private-key", $resolvedPrivateKey,
    "--customer", $Customer,
    "--license-type", $LicenseType,
    "--max-registers", $MaxRegisters.ToString(),
    "--out", $resolvedOut
)

if ($PSCmdlet.ParameterSetName -eq "RequestFile") {
    $resolvedRequestFile = Resolve-ExistingPath -PathValue $RequestFile -Label "El request file"
    $pythonArgs += @("--request-file", $resolvedRequestFile)
}
else {
    $pythonArgs += @("--request-code", $RequestCode)
}

if (-not [string]::IsNullOrWhiteSpace($UpdatesUntil)) {
    $pythonArgs += @("--updates-until", $UpdatesUntil)
}

if ($DurationDays -gt 0) {
    $pythonArgs += @("--duration-days", $DurationDays.ToString())
}

if (-not [string]::IsNullOrWhiteSpace($ExpiresAt)) {
    $pythonArgs += @("--expires-at", $ExpiresAt)
}

if (-not [string]::IsNullOrWhiteSpace($LicenseId)) {
    $pythonArgs += @("--license-id", $LicenseId)
}

foreach ($item in $Feature) {
    if (-not [string]::IsNullOrWhiteSpace($item)) {
        $pythonArgs += @("--feature", $item)
    }
}

Write-Host "Emitiendo licencia..."
Write-Host "  Cliente: $Customer"
Write-Host "  Modo: $Mode"
Write-Host "  Tipo: $LicenseType"
Write-Host "  Cajas: $MaxRegisters"
Write-Host "  Salida: $resolvedOut"

& $python @pythonArgs
