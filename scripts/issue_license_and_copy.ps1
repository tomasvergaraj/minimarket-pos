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

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$issueScript = Join-Path $PSScriptRoot "issue_license.ps1"

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

function Resolve-OutputPath {
    param([Parameter(Mandatory = $true)][string]$PathValue)

    $cleanPath = Normalize-InputText -Value $PathValue

    if ([System.IO.Path]::IsPathRooted($cleanPath)) {
        return $cleanPath
    }

    return (Join-Path $repoRoot $cleanPath)
}

if (-not (Test-Path $issueScript)) {
    throw "No se encontro el script base en: $issueScript"
}

if ([string]::IsNullOrWhiteSpace($Out)) {
    $slug = ConvertTo-Slug -Value $Customer
    $Out = Join-Path (Join-Path $repoRoot "licenses") "$slug-$Mode.json"
}

$resolvedOut = Resolve-OutputPath -PathValue $Out

$invokeParams = @{
    Customer = $Customer
    Mode = $Mode
    Out = $resolvedOut
}

if ($PSCmdlet.ParameterSetName -eq "RequestFile") {
    $invokeParams.RequestFile = $RequestFile
}
else {
    $invokeParams.RequestCode = $RequestCode
}

if ($MaxRegisters -gt 0) {
    $invokeParams.MaxRegisters = $MaxRegisters
}

if (-not [string]::IsNullOrWhiteSpace($UpdatesUntil)) {
    $invokeParams.UpdatesUntil = $UpdatesUntil
}

if ($DurationDays -gt 0) {
    $invokeParams.DurationDays = $DurationDays
}

if (-not [string]::IsNullOrWhiteSpace($ExpiresAt)) {
    $invokeParams.ExpiresAt = $ExpiresAt
}

if (-not [string]::IsNullOrWhiteSpace($LicenseType)) {
    $invokeParams.LicenseType = $LicenseType
}

if (-not [string]::IsNullOrWhiteSpace($LicenseId)) {
    $invokeParams.LicenseId = $LicenseId
}

if (-not [string]::IsNullOrWhiteSpace($PrivateKey)) {
    $invokeParams.PrivateKey = (Normalize-InputText -Value $PrivateKey)
}

foreach ($item in @($Feature)) {
    if (-not [string]::IsNullOrWhiteSpace($item)) {
        if (-not $invokeParams.ContainsKey("Feature")) {
            $invokeParams.Feature = @()
        }
        $invokeParams.Feature += $item
    }
}

& $issueScript @invokeParams

if (-not (Test-Path $resolvedOut)) {
    throw "La licencia se emitio, pero no se encontro el archivo de salida: $resolvedOut"
}

$licenseJson = Get-Content $resolvedOut -Raw

try {
    Set-Clipboard -Value $licenseJson
    Write-Host ""
    Write-Host "Licencia copiada al portapapeles."
    Write-Host "Archivo: $resolvedOut"
}
catch {
    Write-Warning "La licencia se emitio, pero no se pudo copiar al portapapeles."
    Write-Host "Archivo: $resolvedOut"
}
