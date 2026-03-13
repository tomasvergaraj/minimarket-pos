[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$issueAndCopyScript = Join-Path $PSScriptRoot "issue_license_and_copy.ps1"

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

function Read-RequiredText {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [string]$Default = ""
    )

    while ($true) {
        if ([string]::IsNullOrWhiteSpace($Default)) {
            $value = Read-Host $Prompt
        }
        else {
            $value = Read-Host "$Prompt [$Default]"
            if ([string]::IsNullOrWhiteSpace($value)) {
                $value = $Default
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($value)) {
            return (Normalize-InputText -Value $value)
        }

        Write-Host "Debes ingresar un valor." -ForegroundColor Yellow
    }
}

function Read-OptionalText {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [string]$Default = ""
    )

    if ([string]::IsNullOrWhiteSpace($Default)) {
        $value = Read-Host $Prompt
    }
    else {
        $value = Read-Host "$Prompt [$Default]"
        if ([string]::IsNullOrWhiteSpace($value)) {
            return $Default
        }
    }

    return (Normalize-InputText -Value $value)
}

function Read-IntValue {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [int]$Default = 0,
        [switch]$AllowBlank
    )

    while ($true) {
        $suffix = ""
        if ($Default -gt 0) {
            $suffix = " [$Default]"
        }
        elseif ($AllowBlank) {
            $suffix = " [Enter para omitir]"
        }

        $raw = Read-Host "$Prompt$suffix"
        if ([string]::IsNullOrWhiteSpace($raw)) {
            if ($Default -gt 0) {
                return $Default
            }
            if ($AllowBlank) {
                return 0
            }
        }

        $value = 0
        if ([int]::TryParse($raw, [ref]$value) -and $value -ge 0) {
            return $value
        }

        Write-Host "Ingresa un numero valido." -ForegroundColor Yellow
    }
}

function Read-Choice {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][array]$Options
    )

    Write-Host ""
    Write-Host $Title -ForegroundColor Cyan
    foreach ($option in $Options) {
        Write-Host ("  {0}. {1}" -f $option.Key, $option.Label)
    }

    while ($true) {
        $selected = Read-Host "Seleccion"
        $match = $Options | Where-Object { $_.Key -eq $selected } | Select-Object -First 1
        if ($null -ne $match) {
            return $match
        }
        Write-Host "Seleccion invalida." -ForegroundColor Yellow
    }
}

function Read-MultilineText {
    param([Parameter(Mandatory = $true)][string]$Prompt)

    Write-Host $Prompt
    Write-Host "Finaliza pegando una linea vacia." -ForegroundColor DarkGray

    $lines = [System.Collections.Generic.List[string]]::new()
    while ($true) {
        $line = Read-Host
        if ([string]::IsNullOrEmpty($line)) {
            break
        }
        $lines.Add($line)
    }

    return ($lines -join [Environment]::NewLine).Trim()
}

function Split-Features {
    param([string]$Value)

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return @()
    }

    return @(
        $Value.Split(",") |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )
}

if (-not (Test-Path $issueAndCopyScript)) {
    throw "No se encontro el script en: $issueAndCopyScript"
}

Write-Host ""
Write-Host "Nexo - Emision de licencia offline" -ForegroundColor Green
Write-Host ""

$requestSource = Read-Choice -Title "Origen del request" -Options @(
    @{ Key = "1"; Label = "Archivo JSON/base64" },
    @{ Key = "2"; Label = "Pegar codigo o JSON" }
)

$customer = Read-RequiredText -Prompt "Nombre del cliente"
$privateKey = Read-OptionalText -Prompt "Ruta de la clave privada" -Default ".\secrets\license-private.pem"

$modeChoice = Read-Choice -Title "Tipo de licencia" -Options @(
    @{ Key = "1"; Label = "Perpetua + 12 meses de actualizaciones" },
    @{ Key = "2"; Label = "Anual" },
    @{ Key = "3"; Label = "Demo 30 dias" },
    @{ Key = "4"; Label = "Custom" }
)

$mode = "perpetual"
$licenseType = ""
$maxRegisters = 0
$updatesUntil = ""
$durationDays = 0
$expiresAt = ""

switch ($modeChoice.Key) {
    "1" {
        $mode = "perpetual"
        $licenseType = "perpetual"
        $maxRegisters = Read-IntValue -Prompt "Cantidad de cajas" -Default 3
        $defaultUpdates = [DateTimeOffset]::UtcNow.AddYears(1).ToString("yyyy-MM-ddTHH:mm:ssZ")
        $updatesUntil = Read-OptionalText -Prompt "Actualizaciones incluidas hasta" -Default $defaultUpdates
    }
    "2" {
        $mode = "annual"
        $licenseType = "annual"
        $maxRegisters = Read-IntValue -Prompt "Cantidad de cajas" -Default 3
        $durationDays = Read-IntValue -Prompt "Duracion en dias" -Default 365
        $defaultUpdates = [DateTimeOffset]::UtcNow.AddDays($durationDays).ToString("yyyy-MM-ddTHH:mm:ssZ")
        $updatesUntil = Read-OptionalText -Prompt "Actualizaciones incluidas hasta" -Default $defaultUpdates
        $expiresAt = Read-OptionalText -Prompt "Fecha exacta de expiracion (opcional, pisa la duracion)"
    }
    "3" {
        $mode = "demo30"
        $licenseType = "demo"
        $maxRegisters = Read-IntValue -Prompt "Cantidad de cajas" -Default 1
        $durationDays = Read-IntValue -Prompt "Duracion en dias" -Default 30
        $expiresAt = Read-OptionalText -Prompt "Fecha exacta de expiracion (opcional, pisa la duracion)"
    }
    "4" {
        $mode = "custom"
        $licenseType = Read-RequiredText -Prompt "License type" -Default "custom"
        $maxRegisters = Read-IntValue -Prompt "Cantidad de cajas" -Default 3
        $updatesUntil = Read-OptionalText -Prompt "Actualizaciones incluidas hasta (opcional)"
        $durationDays = Read-IntValue -Prompt "Duracion en dias (opcional)" -AllowBlank
        $expiresAt = Read-OptionalText -Prompt "Fecha exacta de expiracion (opcional, pisa la duracion)"
    }
}

$featureInput = Read-OptionalText -Prompt "Features separadas por coma (ej: sii,backup)"
$features = @(Split-Features -Value $featureInput)
$licenseId = Read-OptionalText -Prompt "License ID (opcional)"
$out = Read-OptionalText -Prompt "Archivo de salida (opcional)"

$invokeParams = @{
    Customer = $customer
    Mode = $mode
    PrivateKey = $privateKey
}

if ($requestSource.Key -eq "1") {
    $requestFile = Read-RequiredText -Prompt "Ruta del request file" -Default ".\licenses\cliente-request.json"
    $invokeParams.RequestFile = $requestFile
}
else {
    $requestCode = Read-MultilineText -Prompt "Pega el codigo o JSON del cliente"
    if ([string]::IsNullOrWhiteSpace($requestCode)) {
        throw "No se ingreso ningun request."
    }
    $invokeParams.RequestCode = $requestCode
}

if (-not [string]::IsNullOrWhiteSpace($licenseType)) {
    $invokeParams.LicenseType = $licenseType
}

if ($maxRegisters -gt 0) {
    $invokeParams.MaxRegisters = $maxRegisters
}

if (-not [string]::IsNullOrWhiteSpace($updatesUntil)) {
    $invokeParams.UpdatesUntil = $updatesUntil
}

if ($durationDays -gt 0) {
    $invokeParams.DurationDays = $durationDays
}

if (-not [string]::IsNullOrWhiteSpace($expiresAt)) {
    $invokeParams.ExpiresAt = $expiresAt
}

if (-not [string]::IsNullOrWhiteSpace($licenseId)) {
    $invokeParams.LicenseId = $licenseId
}

if (-not [string]::IsNullOrWhiteSpace($out)) {
    $invokeParams.Out = $out
}

foreach ($feature in @($features)) {
    if (-not $invokeParams.ContainsKey("Feature")) {
        $invokeParams.Feature = @()
    }
    $invokeParams.Feature += $feature
}

Write-Host ""
Write-Host "Resumen" -ForegroundColor Cyan
Write-Host "  Cliente: $customer"
Write-Host "  Modo: $mode"
Write-Host "  Tipo: $licenseType"
Write-Host "  Cajas: $maxRegisters"
if (-not [string]::IsNullOrWhiteSpace($updatesUntil)) {
    Write-Host "  Updates until: $updatesUntil"
}
if ($durationDays -gt 0) {
    Write-Host "  Duracion dias: $durationDays"
}
if (-not [string]::IsNullOrWhiteSpace($expiresAt)) {
    Write-Host "  Expira en: $expiresAt"
}
if (@($features).Count -gt 0) {
    Write-Host "  Features: $($features -join ', ')"
}
if (-not [string]::IsNullOrWhiteSpace($out)) {
    Write-Host "  Salida: $out"
}

$confirm = Read-OptionalText -Prompt "Emitir licencia ahora? (S/n)" -Default "S"
if ($confirm.ToLowerInvariant() -notin @("s", "si", "y", "yes")) {
    Write-Host "Operacion cancelada."
    exit 0
}

Write-Host ""
& $issueAndCopyScript @invokeParams
